import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { appConfig } from '../config';
import type { SourceSnippet } from './source-service';

export interface TemplateRefinedSection {
  title: string;
  summary: string;
  originalHeading: string;
}

export interface SectionRefinementResult {
  sections: TemplateRefinedSection[];
  warnings?: string[];
  codexUsed: boolean;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

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

const CODEX_MODULE_ID = '@openai/codex-sdk';
const isCodexDebugEnabled = (() => {
  const flag = process.env.CODEX_DEBUG;
  if (!flag) return false;
  return flag === '1' || flag.toLowerCase() === 'true';
})();

function codexDebugLog(label: string, payload: unknown) {
  if (!isCodexDebugEnabled) return;
  try {
    const formatted = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    // eslint-disable-next-line no-console
    console.log(`[Codex Debug] ${label}:`, formatted);
  } catch {
    // eslint-disable-next-line no-console
    console.log(`[Codex Debug] ${label}:`, payload);
  }
}

/**
 * Get the path to Codex CLI auth file
 */
function getCodexAuthPath(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.codex', 'auth.json');
}

/**
 * Check if Codex CLI authentication exists
 */
function checkCodexAuth(): { exists: boolean; path: string } {
  const authPath = getCodexAuthPath();
  const exists = fs.existsSync(authPath);
  return { exists, path: authPath };
}

/**
 * Build fallback message with diagnostics
 */
function buildFallbackMessage(): string {
  const authCheck = checkCodexAuth();
  
  if (appConfig.codexApiKey) {
    return `Codex SDK loaded but API key authentication failed.
Please verify your CODEX_API_KEY is correct.`;
  }
  
  if (authCheck.exists) {
    return `Codex SDK not available. CLI auth file found at ${authCheck.path}, but SDK failed to load.

Possible issues:
1. The SDK may not be installed: cd packages/backend && npm install
2. Try re-authenticating: npx codex login
3. Restart the server after fixing

Auth file location: ${authCheck.path}`;
  }
  
  return `Codex SDK not available. No authentication found.

To enable AI content generation:
1. Ensure @openai/codex-sdk is installed: cd packages/backend && npm install
2. Authenticate with Codex CLI: npx codex login
3. Restart the server

Auth will be stored at: ${authCheck.path}
Note: You can also use API key authentication by setting CODEX_API_KEY in .env`;
}

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

/**
 * Log Codex authentication status at startup
 */
export function logCodexAuthStatus(): void {
  const authCheck = checkCodexAuth();
  
  if (appConfig.codexApiKey) {
    // eslint-disable-next-line no-console
    console.log('✓ Codex: Using API key authentication');
  } else if (authCheck.exists) {
    // eslint-disable-next-line no-console
    console.log(`✓ Codex: CLI authentication found at ${authCheck.path}`);
  } else {
    // eslint-disable-next-line no-console
    console.warn(`⚠ Codex: No authentication found. Run 'npx codex login' to authenticate.`);
    // eslint-disable-next-line no-console
    console.warn(`  Auth will be stored at: ${authCheck.path}`);
  }
}

// Ensure CommonJS builds still use the native dynamic import path for ESM Codex SDK
const dynamicImport = new Function('moduleId', 'return import(moduleId);') as <T>(moduleId: string) => Promise<T>;

async function importCodex(): Promise<CodexAdapter | null> {
  const moduleId: string = CODEX_MODULE_ID;
  let codexModule: CodexModuleShape | null = null;

  try {
    const imported = (await dynamicImport<Partial<CodexModuleShape> | null>(moduleId));
    if (!imported || typeof imported.Codex !== 'function') {
      // eslint-disable-next-line no-console
      console.warn('Codex SDK import did not provide a Codex constructor');
      return null;
    }
    codexModule = imported as CodexModuleShape;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Codex SDK import failed:', error);
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
        codexDebugLog('Prompt (truncated to 2K chars)', prompt.slice(0, 2000));

        const result = await thread.run(prompt);
        codexDebugLog('Raw result', result);
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
    // eslint-disable-next-line no-console
    console.warn('Codex SDK initialization failed:', error);
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
      content: `${buildFallbackMessage()}\n\nPrompt Summary:\n${prompt.slice(0, 1000)}`,
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
      content: `${buildFallbackMessage()}\n\nPrompt Summary:\n${prompt.slice(0, 1000)}`,
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

const MAX_REFINEMENT_HEADINGS = 120;

export async function refineTemplateSections(headings: string[]): Promise<SectionRefinementResult> {
  const normalizedHeadings = headings.map((heading) => heading?.trim()).filter((heading) => Boolean(heading)) as string[];

  if (!normalizedHeadings.length) {
    return {
      sections: [],
      warnings: ['No headings available for Codex refinement.'],
      codexUsed: false,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  }

  const exceedsLimit = normalizedHeadings.length > MAX_REFINEMENT_HEADINGS;
  const headingsForCodex = exceedsLimit ? normalizedHeadings.slice(0, MAX_REFINEMENT_HEADINGS) : normalizedHeadings;

  const adapter = await loadCodexAdapter();
  if (!adapter) {
    return {
      sections: [],
      warnings: buildWarnings([
        exceedsLimit ? `Codex refinement limited to the first ${MAX_REFINEMENT_HEADINGS} sections.` : undefined,
        'Codex unavailable; no refined sections generated.'
      ]),
      codexUsed: false,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  }

  const prompt = buildSectionRefinementPrompt(headingsForCodex);

  try {
    const result = await adapter.run(prompt);
    if (!result || !result.output) {
      return {
        sections: [],
        warnings: buildWarnings([
          exceedsLimit ? `Codex refinement limited to the first ${MAX_REFINEMENT_HEADINGS} sections.` : undefined,
          'Codex returned no result; no refined sections generated.'
        ]),
        codexUsed: false,
        usage: normalizeUsage(result?.usage)
      };
    }

    const parsed = parseRefinementOutput(result.output);
    const refinementWarnings: string[] = [];

    if (!parsed) {
      refinementWarnings.push('Codex refinement output could not be parsed; no refined sections generated.');
    }

    const refinedSections = mergeRefinementWithHeadings(normalizedHeadings, parsed, refinementWarnings, exceedsLimit);

    return {
      sections: refinedSections,
      warnings: buildWarnings([
        ...refinementWarnings,
        exceedsLimit ? `Codex refinement limited to the first ${MAX_REFINEMENT_HEADINGS} sections.` : undefined
      ]),
      codexUsed: Boolean(parsed),
      usage: normalizeUsage(result.usage)
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Codex section refinement failed:', error);
    return {
      sections: [],
      warnings: buildWarnings([
        exceedsLimit ? `Codex refinement limited to the first ${MAX_REFINEMENT_HEADINGS} sections.` : undefined,
        error instanceof Error ? `Codex refinement failed: ${error.message}` : 'Codex refinement failed; no refined sections generated.'
      ]),
      codexUsed: false,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  }
}

function buildSectionRefinementPrompt(headings: string[]): string {
  const numberedHeadings = headings.map((heading, index) => `${index + 1}. ${heading}`).join('\n');

  const instruction = [
    'Given numbered headings, respond ONLY with minified JSON using the schema: {"sections":[{"title":"...","summary":"...","originalHeading":"..."}]}.',
    '- Preserve heading order.',
    '- Craft concise, action-oriented summaries (2-3 sentences) describing the expected content, required evidence, and regulatory focus for each section.',
    '- Use domain-appropriate language and avoid markdown or bullet lists in summaries.',
    '- If a heading is unclear, clarify its intent in the summary rather than refusing.'
  ].join('\n');

  return [
    'You assist with structuring regulatory dossier templates.',
    instruction,
    `Headings:\n${numberedHeadings}`
  ].join('\n\n');
}

function parseRefinementOutput(output: string): Array<{ title?: unknown; summary?: unknown; originalHeading?: unknown }> | null {
  const candidate = extractJsonCandidate(output);
  if (!candidate) {
    return null;
  }

  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as Array<{ title?: unknown; summary?: unknown; originalHeading?: unknown }>;
    }

    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { sections?: unknown }).sections)) {
      return (parsed as { sections: Array<{ title?: unknown; summary?: unknown; originalHeading?: unknown }> }).sections;
    }

    return null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to parse Codex refinement output as JSON:', error);
    return null;
  }
}

function extractJsonCandidate(output: string): string | null {
  const codeBlockMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1].trim();
  }

  const firstBrace = output.indexOf('{');
  const lastBrace = output.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return output.slice(firstBrace, lastBrace + 1);
  }

  const firstBracket = output.indexOf('[');
  const lastBracket = output.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return output.slice(firstBracket, lastBracket + 1);
  }

  return null;
}

function mergeRefinementWithHeadings(
  headings: string[],
  parsed: Array<{ title?: unknown; summary?: unknown; originalHeading?: unknown }> | null,
  warnings: string[],
  exceededLimit: boolean
): TemplateRefinedSection[] {
  const parsedSections = Array.isArray(parsed) ? parsed : [];

  if (!parsedSections.length) {
    return [];
  }

  const refined: TemplateRefinedSection[] = [];

  const parsedByOriginal: Map<string, { title?: unknown; summary?: unknown }> = new Map();
  for (const entry of parsedSections) {
    if (entry && typeof entry === 'object' && typeof entry.originalHeading === 'string') {
      parsedByOriginal.set(entry.originalHeading.trim(), { title: entry.title, summary: entry.summary });
    }
  }

  headings.forEach((heading, index) => {
    const normalizedHeading = heading.trim();
    let candidate = parsedSections[index];

    if (!candidate && parsedByOriginal.has(normalizedHeading)) {
      candidate = { ...parsedByOriginal.get(normalizedHeading), originalHeading: normalizedHeading } as {
        title?: unknown;
        summary?: unknown;
        originalHeading?: unknown;
      };
    }

    if (!candidate) {
      return;
    }

    const title = typeof candidate?.title === 'string' && candidate.title.trim().length
      ? candidate.title.trim()
      : normalizedHeading;

    if (!candidate?.summary || typeof candidate.summary !== 'string' || !candidate.summary.trim()) {
      return;
    }

    refined.push({
      title,
      summary: candidate.summary.trim(),
      originalHeading: normalizedHeading
    });
  });

  if (refined.length !== headings.length) {
    warnings.push('Codex refinement did not return usable sections for all headings.');
  }

  if (exceededLimit && refined.length) {
    warnings.push(`Codex refinement limited to the first ${MAX_REFINEMENT_HEADINGS} sections.`);
  }

  return refined;
}

function buildWarnings(warnings: Array<string | undefined>): string[] | undefined {
  const filtered = warnings.map((warning) => warning?.trim()).filter((warning): warning is string => Boolean(warning));
  if (!filtered.length) {
    return undefined;
  }

  const unique = new Set<string>();
  const normalized: string[] = [];
  for (const warning of filtered) {
    if (unique.has(warning)) continue;
    unique.add(warning);
    normalized.push(warning);
  }

  return normalized;
}
