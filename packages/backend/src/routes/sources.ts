import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { FileValidationError } from '../services/file-service';
import { listSources, saveSources, getSourceById, updateSourceTags } from '../services/source-service';

const querySchema = z.object({
  search: z.string().trim().optional()
});

const patchTagsSchema = z.object({
  tags: z.array(z.string().trim().min(1).max(50)).max(20)
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

export const sourcesRouter = express.Router();

sourcesRouter.get('/', async (req, res, next) => {
  try {
    const { search } = querySchema.parse(req.query);
    const results = await listSources(search);
    res.json({ sources: results });
  } catch (error) {
    next(error);
  }
});

sourcesRouter.post('/upload', upload.array('files', 20), async (req, res, next) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'No files uploaded.'
      });
    }

    const files = req.files as Express.Multer.File[];
    const result = await saveSources(
      files.map((file) => ({
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        buffer: file.buffer
      }))
    );

    res.status(201).json(result);
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

sourcesRouter.patch('/:id/tags', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parseResult = patchTagsSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Invalid tag data.',
        details: parseResult.error.errors
      });
    }

    const { tags } = parseResult.data;

    const existing = await getSourceById(id);
    if (!existing) {
      return res.status(404).json({
        error: 'NotFound',
        message: `Source with id "${id}" not found.`
      });
    }

    const updated = await updateSourceTags(id, tags);
    if (!updated) {
      return res.status(500).json({
        error: 'UpdateFailed',
        message: 'Failed to update source tags.'
      });
    }

    res.json({ source: updated });
  } catch (error) {
    next(error);
  }
});
