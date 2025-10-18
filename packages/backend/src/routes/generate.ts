import { Router } from 'express';
import { z } from 'zod';
import { fetchSourceSnippets } from '../services/source-service';
import { generateDraft } from '../services/codex-service';

const requestSchema = z.object({
  sectionId: z.string().min(1),
  sectionTitle: z.string().min(1),
  prompt: z.string().min(1),
  selectedSourceIds: z.array(z.string()).default([])
});

export const generateRouter = Router();

generateRouter.post('/', async (req, res, next) => {
  try {
    const payload = requestSchema.parse(req.body);

    const snippets = await fetchSourceSnippets(payload.selectedSourceIds);
    const result = await generateDraft({
      sectionTitle: payload.sectionTitle,
      userPrompt: payload.prompt,
      snippets
    });

    res.json({
      content: result.content,
      metadata: {
        ...result.metadata,
        sectionId: payload.sectionId,
        sectionTitle: payload.sectionTitle,
        sources: snippets.map((snippet) => ({
          id: snippet.id,
          name: snippet.name,
          warnings: snippet.warnings
        }))
      },
      usage: result.usage
    });
  } catch (error) {
    next(error);
  }
});
