import { appConfig } from '../config';
import type { SourceSnippet } from './source-service';

interface GenerateParams {
  sectionTitle: string;
  userPrompt: string;
  snippets: SourceSnippet[];
}

interface GenerateResult {
  content: string;
  metadata: Record<string, unknown>;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

const FALLBACK_MESSAGE = 'Codex SDK not configured. Ensure the Codex CLI is installed and run `codex login` (or set CODEX_API_KEY) before retrying.';
const CODEX_MODULE_ID = '@openai/codex-sdk';

let codexPromise: Promise<CodexAdapter | null> | null = null;

interface CodexAdapter {
  run(prompt: string): Promise<{ output?: string; usage?: CodexUsageSnapshot } | null>;
}

interface CodexUsageSnapshot {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

interface CodexModuleShape {
  Codex: new (options?: { apiKey?: string }) => {
    startThread: (options?: { skipGitRepoCheck?: boolean; workingDirectory?: string }) => {
      run: (prompt: string) => Promise<CodexRunResult>;
    };
  };
}

type CodexRunResult =
  | string
  | {
      finalResponse?: string;
      items?: Array<{ type?: string; text?: string }>;
      usage?: {
        input_tokens?: number;
        cached_input_tokens?: number;
        output_tokens?: number;
      };
      [key: string]: unknown;
    };

async function loadCodexAdapter(): Promise<CodexAdapter | null> {
  if (!codexPromise) {
    codexPromise = importCodex().catch((error) => {
      // eslint-disable-next-line no-console
      console.warn('Codex SDK import failed:', error);
      return null;
    });
  }

  return codexPromise;
}

async function importCodex(): Promise<CodexAdapter | null> {
  const moduleId: string = CODEX_MODULE_ID;
  let codexModule: CodexModuleShape | null = null;

  try {
    const imported = (await import(moduleId)) as Partial<CodexModuleShape> | null;
    if (!imported || typeof imported.Codex !== 'function') {
      return null;
    }
    codexModule = imported as CodexModuleShape;
  } catch (error) {
    return null;
  }

  try {
    const codex = new codexModule.Codex(
      appConfig.codexApiKey ? { apiKey: appConfig.codexApiKey } : undefined
    );
    const thread = codex.startThread({
      skipGitRepoCheck: true,
      workingDirectory: process.cwd()
    });

    return {
      async run(prompt: string) {
        const result = await thread.run(prompt);
        if (!result) {
          return null;
        }

        if (typeof result === 'string') {
          return { output: result };
        }

        const output =
          typeof result.finalResponse === 'string' && result.finalResponse.trim().length > 0
            ? result.finalResponse
            : maybeExtractAgentMessage(result);

        const usage = result.usage
          ? {
              inputTokens: result.usage.input_tokens ?? 0,
              cachedInputTokens: result.usage.cached_input_tokens ?? 0,
              outputTokens: result.usage.output_tokens ?? 0
            }
          : undefined;

        return {
          output: output ?? '',
          usage
        };
      }
    };
  } catch (error) {
    return null;
  }
}

function maybeExtractAgentMessage(result: { items?: Array<{ type?: string; text?: string }> }): string | undefined {
  if (!Array.isArray(result.items)) {
    return undefined;
  }

  for (const item of result.items) {
    if (item && item.type === 'agent_message' && typeof item.text === 'string' && item.text.trim().length > 0) {
      return item.text;
    }
  }

  return undefined;
}

function buildPrompt({ sectionTitle, userPrompt, snippets }: GenerateParams): string {
  const contextBlocks = snippets
    .map((snippet) => {
      const warningText = snippet.warnings?.length ? `\nWarnings: ${snippet.warnings.join('; ')}` : '';
      const contentText = snippet.content ? `\n${snippet.content}` : '';
      return `Source: ${snippet.name}${warningText}${contentText}`;
    })
    .join('\n\n');

  return [`You are assisting with drafting "${sectionTitle}" in a regulatory dossier.`,
    'Use the provided source snippets where helpful and respond with well-structured markdown.',
    `Analyst instructions: ${userPrompt}`,
    contextBlocks ? `Source snippets:\n${contextBlocks}` : 'No source snippets were found. Provide general guidance only.'
  ].join('\n\n');
}

export async function generateDraft(params: GenerateParams): Promise<GenerateResult> {
  const prompt = buildPrompt(params);
  const adapter = await loadCodexAdapter();

  if (!adapter) {
    return {
      content: `${FALLBACK_MESSAGE}\n\nPrompt Summary:\n${prompt.slice(0, 1000)}`,
      metadata: {
        codexUsed: false,
        snippetCount: params.snippets.length
      },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  }

  try {
    const result = await adapter.run(prompt);
    if (!result) {
      throw new Error('Codex returned no result');
    }

    return {
      content: result.output && result.output.trim().length > 0 ? result.output : 'Codex returned an empty response.',
      metadata: {
        codexUsed: true,
        snippetCount: params.snippets.length
      },
      usage: normalizeUsage(result.usage)
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Codex generation failed:', error);
    return {
      content: `${FALLBACK_MESSAGE}\n\nPrompt Summary:\n${prompt.slice(0, 1000)}`,
      metadata: {
        codexUsed: false,
        snippetCount: params.snippets.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      usage: normalizeUsage()
    };
  }
}

function normalizeUsage(usage?: CodexUsageSnapshot): { promptTokens: number; completionTokens: number; totalTokens: number } {
  const promptTokens = (usage?.inputTokens ?? 0) + (usage?.cachedInputTokens ?? 0);
  const completionTokens = usage?.outputTokens ?? 0;
  const totalTokens = promptTokens + completionTokens;

  return { promptTokens, completionTokens, totalTokens };
}
