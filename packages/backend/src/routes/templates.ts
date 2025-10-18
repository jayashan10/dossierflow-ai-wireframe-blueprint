import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { FileValidationError } from '../services/file-service';
import { saveTemplate, listTemplates, getTemplate } from '../services/template-service';

const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const getTemplateParamsSchema = z.object({
  id: z.string().min(1)
});

export const templatesRouter = express.Router();

templatesRouter.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'No file uploaded.'
      });
    }

    const template = await saveTemplate({
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      buffer: req.file.buffer
    });

    res.status(201).json({ template });
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

templatesRouter.get('/', async (_req, res, next) => {
  try {
    const templates = await listTemplates();
    res.json({ templates });
  } catch (error) {
    next(error);
  }
});

templatesRouter.get('/:id', async (req, res, next) => {
  try {
    const params = getTemplateParamsSchema.parse(req.params);
    const template = await getTemplate(params.id);

    if (!template) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Template not found.'
      });
    }

    res.json({ template });
  } catch (error) {
    next(error);
  }
});

