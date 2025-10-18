import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { FileValidationError } from '../services/file-service';
import { listSources, saveSources } from '../services/source-service';

const querySchema = z.object({
  search: z.string().trim().optional()
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
