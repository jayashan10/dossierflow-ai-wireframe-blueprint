import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { fetchSourceSnippets, fetchSourceSnippetsFromDescriptors, getSourceFilePaths } from '../services/source-service';
import { generateDraft, generateDraftStream, refineInlineStream } from '../services/claude-agent-service';
import {
  appendProgramAuditEntry,
  getProgramAbsolutePath,
  getProgram,
  getProgramSourceFileRefs,
  listProgramSources,
  writeSectionTraceMetadata
} from '../services/program-service';

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
  targetPath: z.string().optional(),
  runId: z.string().optional()
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

  let clientDisconnected = false;
  let terminalSent = false;
  req.on('close', () => {
    clientDisconnected = true;
  });

  const writeEvent = (event: Record<string, unknown>) => {
    if (clientDisconnected || res.writableEnded) {
      return;
    }
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const finish = () => {
    if (terminalSent || clientDisconnected || res.writableEnded) {
      return;
    }
    terminalSent = true;
    res.write('data: [DONE]\n\n');
    res.end();
  };

  try {
    const payload = streamRequestSchema.parse(req.body);
    const runId = payload.runId ?? `run_${crypto.randomUUID()}`;

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
        writeEvent({ type: 'error', runId, error: `Program "${payload.programId}" not found` });
        finish();
        return;
      }
      programPath = getProgramAbsolutePath(payload.programId);

      await appendProgramAuditEntry(payload.programId, {
        action: 'generation_started',
        runId,
        sectionId: payload.sectionId,
        filePath: payload.targetPath,
        details: {
          sectionTitle: payload.sectionTitle,
          selectedSourceCount: payload.selectedSourceIds.length,
          mentionedFileCount: payload.mentionedFileIds.length
        }
      });
    }

    // Stream events from agent
    for await (const event of generateDraftStream({
      sectionTitle: payload.sectionTitle,
      userPrompt: payload.prompt,
      sourceFiles,
      mentionedFiles,
      programPath,
      targetPath: payload.targetPath,
      runId,
      shouldAbort: () => clientDisconnected
    })) {
      if (clientDisconnected) {
        if (payload.programId) {
          await appendProgramAuditEntry(payload.programId, {
            action: 'generation_cancelled',
            runId,
            sectionId: payload.sectionId,
            filePath: payload.targetPath,
            details: {
              reason: 'Client disconnected'
            }
          });
        }
        break;
      }

      writeEvent({ ...event, runId: event.runId ?? runId });

      // If this is a 'complete' event and we wrote to a file, add file_written info
      if (event.type === 'complete' && payload.programId && payload.targetPath) {
        writeEvent({
          type: 'file_written',
          runId,
          path: payload.targetPath,
          programId: payload.programId
        });

        try {
          await writeSectionTraceMetadata(payload.programId, {
            runId,
            sectionId: payload.sectionId,
            sectionTitle: payload.sectionTitle,
            targetPath: payload.targetPath,
            prompt: payload.prompt,
            selectedSourceIds: payload.selectedSourceIds,
            mentionedFileIds: payload.mentionedFileIds,
            sourceFiles: sourceFiles.map((source) => ({
              id: source.id,
              name: source.name,
              relativePath: source.relativePath
            })),
            mentionedFiles: mentionedFiles.map((source) => ({
              id: source.id,
              name: source.name,
              relativePath: source.relativePath
            })),
            usage: event.usage,
            model: 'claude-agent-sdk',
            toolsUsed: event.toolsUsed,
            status: 'completed',
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
          });

          await appendProgramAuditEntry(payload.programId, {
            action: 'file_written',
            runId,
            sectionId: payload.sectionId,
            filePath: payload.targetPath
          });

          await appendProgramAuditEntry(payload.programId, {
            action: 'generation_completed',
            runId,
            sectionId: payload.sectionId,
            filePath: payload.targetPath,
            details: {
              usage: event.usage,
              toolsUsed: event.toolsUsed,
              turnsCompleted: event.turnsCompleted
            }
          });
        } catch (syncError) {
          const syncMessage = syncError instanceof Error ? syncError.message : 'Failed to persist generation metadata.';
          writeEvent({
            type: 'sync_failed',
            runId,
            path: payload.targetPath,
            error: syncMessage,
            details: {
              operation: 'trace_metadata'
            }
          });

          await appendProgramAuditEntry(payload.programId, {
            action: 'sync_failed',
            runId,
            sectionId: payload.sectionId,
            filePath: payload.targetPath,
            details: {
              error: syncMessage,
              operation: 'trace_metadata'
            }
          });
        }
      }

      if (event.type === 'run_cancelled' && payload.programId) {
        if (payload.targetPath) {
          try {
            await writeSectionTraceMetadata(payload.programId, {
              runId,
              sectionId: payload.sectionId,
              sectionTitle: payload.sectionTitle,
              targetPath: payload.targetPath,
              prompt: payload.prompt,
              selectedSourceIds: payload.selectedSourceIds,
              mentionedFileIds: payload.mentionedFileIds,
              sourceFiles: sourceFiles.map((source) => ({
                id: source.id,
                name: source.name,
                relativePath: source.relativePath
              })),
              mentionedFiles: mentionedFiles.map((source) => ({
                id: source.id,
                name: source.name,
                relativePath: source.relativePath
              })),
              model: 'claude-agent-sdk',
              toolsUsed: event.toolsUsed,
              status: 'cancelled',
              error: 'Generation cancelled before completion.',
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString()
            });
          } catch {
            // Non-blocking trace persistence failure handled by audit below.
          }
        }

        await appendProgramAuditEntry(payload.programId, {
          action: 'generation_cancelled',
          runId,
          sectionId: payload.sectionId,
          filePath: payload.targetPath,
          details: {
            reason: 'Agent cancelled'
          }
        });
      }

      if (event.type === 'error' && payload.programId) {
        if (payload.targetPath) {
          try {
            await writeSectionTraceMetadata(payload.programId, {
              runId,
              sectionId: payload.sectionId,
              sectionTitle: payload.sectionTitle,
              targetPath: payload.targetPath,
              prompt: payload.prompt,
              selectedSourceIds: payload.selectedSourceIds,
              mentionedFileIds: payload.mentionedFileIds,
              sourceFiles: sourceFiles.map((source) => ({
                id: source.id,
                name: source.name,
                relativePath: source.relativePath
              })),
              mentionedFiles: mentionedFiles.map((source) => ({
                id: source.id,
                name: source.name,
                relativePath: source.relativePath
              })),
              model: 'claude-agent-sdk',
              toolsUsed: event.toolsUsed,
              status: 'error',
              error: event.error,
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString()
            });
          } catch {
            // Non-blocking trace persistence failure handled by audit below.
          }
        }

        await appendProgramAuditEntry(payload.programId, {
          action: 'generation_error',
          runId,
          sectionId: payload.sectionId,
          filePath: payload.targetPath,
          details: {
            error: event.error
          }
        });
      }
    }

    finish();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    writeEvent({ type: 'error', error: errorMessage });
    finish();
  }
});

const refineRequestSchema = z.object({
  selectedText: z.string().min(1),
  action: z.enum(['improve', 'expand', 'simplify', 'add_references', 'rewrite', 'make_concise', 'formal_tone', 'custom']),
  customInstruction: z.string().optional(),
  sectionTitle: z.string().optional(),
  surroundingContext: z.string().optional()
});

generateRouter.post('/refine', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const payload = refineRequestSchema.parse(req.body);

    for await (const event of refineInlineStream(payload)) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
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
