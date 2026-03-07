import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import {
  createProgram,
  getProgram,
  deleteProgram,
  listPrograms,
  listProgramFiles,
  readProgramFile,
  writeProgramFile,
  createProgramFile,
  deleteProgramFile,
  addProgramLinkedSource,
  listProgramSources,
  saveTemplateToProgram,
  getProgramAbsolutePath,
  setSections,
  updateSectionStatus,
  type ProgramMetadata,
  type ProgramSection
} from '../services/program-service';
import { FileValidationError, sanitizeFileName, validateUpload } from '../services/file-service';
import { createProgramStructure } from '../services/agent-provider';

const memoryStorage = multer.memoryStorage();
const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ============================================================================
// Validation Schemas
// ============================================================================

const createProgramSchema = z.object({
  name: z.string().min(1).max(200)
});

const programIdSchema = z.object({
  programId: z.string().min(1)
});

const filePathSchema = z.object({
  0: z.string().optional() // Wildcard path parameter
});

const writeFileSchema = z.object({
  content: z.string()
});

const createStructureSchema = z.object({
  sections: z.array(z.object({
    title: z.string().min(1),
    summary: z.string().optional(),
    originalHeading: z.string().optional()
  })).min(1)
});

const updateSectionSchema = z.object({
  status: z.enum(['pending', 'draft', 'reviewed', 'approved']).optional(),
  tokenUsage: z.object({
    promptTokens: z.number().min(0),
    completionTokens: z.number().min(0),
    totalTokens: z.number().min(0)
  }).optional()
});

const sourceSearchSchema = z.object({
  search: z.string().trim().optional()
});

// ============================================================================
// Router
// ============================================================================

export const programsRouter = express.Router();

// ----------------------------------------------------------------------------
// Program CRUD
// ----------------------------------------------------------------------------

/**
 * POST /api/programs
 * Create a new program folder
 */
programsRouter.post('/', async (req, res, next) => {
  try {
    const body = createProgramSchema.parse(req.body);
    const program = await createProgram(body.name);
    res.status(201).json({ program });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid request body.',
        details: error.errors
      });
    }
    if (error instanceof Error && error.message.includes('already exists')) {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message
      });
    }
    next(error);
  }
});

/**
 * GET /api/programs
 * List all programs
 */
programsRouter.get('/', async (_req, res, next) => {
  try {
    const programs = await listPrograms();
    res.json({ programs });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/programs/:programId
 * Get program metadata
 */
programsRouter.get('/:programId', async (req, res, next) => {
  try {
    const params = programIdSchema.parse(req.params);
    const program = await getProgram(params.programId);

    if (!program) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Program not found.'
      });
    }

    res.json({ program });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/programs/:programId
 * Delete a program and all its files
 */
programsRouter.delete('/:programId', async (req, res, next) => {
  try {
    const params = programIdSchema.parse(req.params);
    await deleteProgram(params.programId);
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Program not found.'
      });
    }
    next(error);
  }
});

// ----------------------------------------------------------------------------
// File Operations
// ----------------------------------------------------------------------------

/**
 * GET /api/programs/:programId/files
 * List all files in a program (recursive tree)
 */
programsRouter.get('/:programId/files', async (req, res, next) => {
  try {
    const params = programIdSchema.parse(req.params);
    const files = await listProgramFiles(params.programId);
    res.json({ files });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Program not found.'
      });
    }
    next(error);
  }
});

/**
 * GET /api/programs/:programId/files/*
 * Read a specific file's content
 */
programsRouter.get('/:programId/files/*', async (req, res, next) => {
  try {
    const params = programIdSchema.parse(req.params);
    const filePath = (req.params as Record<string, string>)[0];

    if (!filePath) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'File path is required.'
      });
    }

    const content = await readProgramFile(params.programId, filePath);

    // Determine content type based on extension
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (ext === 'json') {
      res.type('application/json');
    } else if (ext === 'md') {
      res.type('text/markdown');
    } else {
      res.type('text/plain');
    }

    res.send(content);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'NotFound',
          message: error.message
        });
      }
      if (error.message.includes('traversal')) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied.'
        });
      }
      if (error.message.includes('Cannot read directory')) {
        return res.status(400).json({
          error: 'BadRequest',
          message: error.message
        });
      }
    }
    next(error);
  }
});

/**
 * PUT /api/programs/:programId/files/*
 * Update a file's content (or create if doesn't exist)
 */
programsRouter.put('/:programId/files/*', async (req, res, next) => {
  try {
    const params = programIdSchema.parse(req.params);
    const filePath = (req.params as Record<string, string>)[0];

    if (!filePath) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'File path is required.'
      });
    }

    // Support both JSON body and raw text body
    let content: string;
    if (typeof req.body === 'string') {
      content = req.body;
    } else if (typeof req.body?.content === 'string') {
      content = req.body.content;
    } else {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Content is required. Send as { "content": "..." } or raw text.'
      });
    }

    await writeProgramFile(params.programId, filePath, content);
    res.json({ success: true, path: filePath });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'NotFound',
          message: error.message
        });
      }
      if (error.message.includes('traversal')) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied.'
        });
      }
    }
    next(error);
  }
});

/**
 * POST /api/programs/:programId/files/*
 * Create a new file (fails if exists)
 */
programsRouter.post('/:programId/files/*', async (req, res, next) => {
  try {
    const params = programIdSchema.parse(req.params);
    const filePath = (req.params as Record<string, string>)[0];

    if (!filePath) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'File path is required.'
      });
    }

    // Support both JSON body and raw text body
    let content: string;
    if (typeof req.body === 'string') {
      content = req.body;
    } else if (typeof req.body?.content === 'string') {
      content = req.body.content;
    } else {
      content = ''; // Allow creating empty files
    }

    await createProgramFile(params.programId, filePath, content);
    res.status(201).json({ success: true, path: filePath });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'Conflict',
          message: error.message
        });
      }
      if (error.message.includes('traversal')) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied.'
        });
      }
    }
    next(error);
  }
});

/**
 * DELETE /api/programs/:programId/files/*
 * Delete a file or folder
 */
programsRouter.delete('/:programId/files/*', async (req, res, next) => {
  try {
    const params = programIdSchema.parse(req.params);
    const filePath = (req.params as Record<string, string>)[0];

    if (!filePath) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'File path is required.'
      });
    }

    await deleteProgramFile(params.programId, filePath);
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'NotFound',
          message: error.message
        });
      }
      if (error.message.includes('traversal')) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied.'
        });
      }
      if (error.message.includes('Cannot delete program metadata')) {
        return res.status(403).json({
          error: 'Forbidden',
          message: error.message
        });
      }
    }
    next(error);
  }
});

// ----------------------------------------------------------------------------
// Source Linking
// ----------------------------------------------------------------------------

/**
 * POST /api/programs/:programId/sources
 * Upload or link a source document to the program
 */
programsRouter.post('/:programId/sources', upload.single('file'), async (req, res, next) => {
  try {
    const params = programIdSchema.parse(req.params);

    if (!req.file) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'No file uploaded.'
      });
    }

    // Save the file to program's sources folder
    const program = await getProgram(params.programId);
    if (!program) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Program not found.'
      });
    }

    const sanitizedFileName = sanitizeFileName(req.file.originalname);
    validateUpload({
      originalName: sanitizedFileName,
      mimeType: req.file.mimetype,
      size: req.file.size,
      buffer: req.file.buffer
    });

    // Write file directly to sources folder (binary safe)
    const sourcePath = `sources/${sanitizedFileName}`;
    await writeProgramFile(params.programId, sourcePath, req.file.buffer);

    const programPath = getProgramAbsolutePath(params.programId);
    const absolutePath = path.join(programPath, sourcePath);
    const extension = path.extname(sanitizedFileName).toLowerCase();

    await addProgramLinkedSource(params.programId, sourcePath);

    const stats = await fs.stat(absolutePath);

    res.status(201).json({
      source: {
        id: sourcePath,
        name: req.file.originalname,
        type: extension.replace('.', ''),
        path: sourcePath,
        tags: [],
        createdAt: (stats.birthtime ?? stats.mtime).toISOString()
      }
    });
  } catch (error) {
    if (error instanceof FileValidationError) {
      return res.status(400).json({
        error: error.name,
        message: error.message,
        details: error.details
      });
    }
    next(error);
  }
});

/**
 * GET /api/programs/:programId/sources
 * List sources linked to a program
 */
programsRouter.get('/:programId/sources', async (req, res, next) => {
  try {
    const params = programIdSchema.parse(req.params);
    const { search } = sourceSearchSchema.parse(req.query);
    const sources = await listProgramSources(params.programId);
    const filtered = search
      ? sources.filter((source) => source.name.toLowerCase().includes(search.toLowerCase()))
      : sources;

    res.json({
      sources: filtered.map((source) => ({
        id: source.id,
        name: source.name,
        type: source.type,
        path: source.relativePath,
        tags: source.tags,
        createdAt: source.createdAt
      }))
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: 'NotFound',
        message: error.message
      });
    }
    next(error);
  }
});

// ----------------------------------------------------------------------------
// Template Upload
// ----------------------------------------------------------------------------

/**
 * POST /api/programs/:programId/template
 * Upload a template to the program
 */
programsRouter.post('/:programId/template', upload.single('file'), async (req, res, next) => {
  try {
    const params = programIdSchema.parse(req.params);

    if (!req.file) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'No file uploaded.'
      });
    }

    const program = await getProgram(params.programId);
    if (!program) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Program not found.'
      });
    }

    const templatePath = await saveTemplateToProgram(
      params.programId,
      req.file.buffer,
      req.file.originalname
    );

    res.status(201).json({
      success: true,
      path: templatePath
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------------------------------
// Structure Creation
// ----------------------------------------------------------------------------

/**
 * POST /api/programs/:programId/structure
 * Create folder structure from extracted sections using Claude Agent
 */
programsRouter.post('/:programId/structure', async (req, res, next) => {
  try {
    const params = programIdSchema.parse(req.params);
    const body = createStructureSchema.parse(req.body);

    const program = await getProgram(params.programId);
    if (!program) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Program not found.'
      });
    }

    const programPath = getProgramAbsolutePath(params.programId);

    // Call Claude Agent to create folder structure
    const result = await createProgramStructure({
      programPath,
      sections: body.sections
    });

    // Update program.json with created sections
    if (result.success && result.filesCreated.length > 0) {
      const sectionsRecord: Record<string, ProgramSection> = {};
      const orderByTitle = new Map<string, number>();
      body.sections.forEach((section, index) => {
        if (!orderByTitle.has(section.title)) {
          orderByTitle.set(section.title, index + 1);
        }
      });

      for (const [index, file] of result.filesCreated.entries()) {
        // Create a section ID from the path
        const sectionId = file.path
          .replace(/\/content\.md$/, '')
          .replace(/\//g, '-')
          .replace(/^sections-/, '');

        sectionsRecord[sectionId] = {
          title: file.section,
          path: file.path,
          status: 'pending',
          order: orderByTitle.get(file.section) ?? index + 1
        };
      }

      await setSections(params.programId, sectionsRecord, result.sectionRoot);
    }

    res.json({
      success: result.success,
      filesCreated: result.filesCreated,
      sectionRoot: result.sectionRoot,
      warnings: result.warnings,
      usage: result.usage
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid request body.',
        details: error.errors
      });
    }
    next(error);
  }
});

// ----------------------------------------------------------------------------
// Section Updates
// ----------------------------------------------------------------------------

/**
 * PATCH /api/programs/:programId/sections/:sectionKey
 * Update section status and metadata
 */
programsRouter.patch('/:programId/sections/:sectionKey', async (req, res, next) => {
  try {
    const params = programIdSchema.parse(req.params);
    const sectionKey = req.params.sectionKey;

    if (!sectionKey) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Section key is required.'
      });
    }

    const body = updateSectionSchema.parse(req.body);
    if (!body.status) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Section status is required.'
      });
    }

    await updateSectionStatus(params.programId, sectionKey, body.status, body.tokenUsage);

    const program = await getProgram(params.programId);
    const section = program?.sections?.[sectionKey];

    if (!section) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Section not found.'
      });
    }

    res.json({ section });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid request body.',
        details: error.errors
      });
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: 'NotFound',
        message: error.message
      });
    }
    next(error);
  }
});
