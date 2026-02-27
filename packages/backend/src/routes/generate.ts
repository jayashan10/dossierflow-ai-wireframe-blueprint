import { Router } from 'express';
import { z } from 'zod';
import { fetchSourceSnippets, fetchSourceSnippetsFromDescriptors, getSourceFilePaths } from '../services/source-service';
import { generateDraft, generateDraftStream } from '../services/claude-agent-service';
import { getProgramAbsolutePath, getProgram, getProgramSourceFileRefs, listProgramSources } from '../services/program-service';

const requestSchema = z.object({
  sectionId: z.string().min(1),
  sectionTitle: z.string().min(1),
  prompt: z.string().min(1),
  selectedSourceIds: z.array(z.string()).default([]),
  programId: z.string().optional()
});

const streamRequestSchema = z.object({
  sectionId: z.string().min(1),
  sectionTitle: z.string().min(1),
  prompt: z.string().min(1),
  selectedSourceIds: z.array(z.string()).default([]),
  mentionedFileIds: z.array(z.string()).default([]),
  // Optional: write to program file
  programId: z.string().optional(),
  targetPath: z.string().optional()
});

export const generateRouter = Router();

generateRouter.post('/', async (req, res, next) => {
  try {
    const payload = requestSchema.parse(req.body);

    const snippets = payload.programId
      ? await fetchSourceSnippetsFromDescriptors(
          (await listProgramSources(payload.programId))
            .filter((source) => payload.selectedSourceIds.includes(source.id))
        )
      : await fetchSourceSnippets(payload.selectedSourceIds);
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

// Streaming generation endpoint using SSE
generateRouter.post('/stream', async (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  try {
    const payload = streamRequestSchema.parse(req.body);

    // Get file paths for selected sources
    const sourceFiles = payload.programId
      ? await getProgramSourceFileRefs(payload.programId, payload.selectedSourceIds)
      : await getSourceFilePaths(payload.selectedSourceIds);

    // Get file paths for mentioned files (from @file references)
    const mentionedFiles = payload.mentionedFileIds.length > 0
      ? (payload.programId
          ? await getProgramSourceFileRefs(payload.programId, payload.mentionedFileIds)
          : await getSourceFilePaths(payload.mentionedFileIds))
      : [];

    // Resolve program path if programId is provided
    let programPath: string | undefined;
    if (payload.programId) {
      const program = await getProgram(payload.programId);
      if (!program) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: `Program "${payload.programId}" not found` })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
      programPath = getProgramAbsolutePath(payload.programId);
    }

    // Stream events from agent
    for await (const event of generateDraftStream({
      sectionTitle: payload.sectionTitle,
      userPrompt: payload.prompt,
      sourceFiles,
      mentionedFiles,
      programPath,
      targetPath: payload.targetPath
    })) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      // If this is a 'complete' event and we wrote to a file, add file_written info
      if (event.type === 'complete' && payload.programId && payload.targetPath) {
        res.write(`data: ${JSON.stringify({
          type: 'file_written',
          path: payload.targetPath,
          programId: payload.programId
        })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});
