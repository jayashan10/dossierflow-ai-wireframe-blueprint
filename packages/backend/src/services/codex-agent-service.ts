import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { appConfig } from '../config';
import type { SourceSnippet } from './source-service';
import type {
  TemplateRefinedSection,
  SectionRefinementResult,
  StreamGenerateParams,
  StructureCreationParams,
  StructureCreationResult,
  StreamEvent,
  InlineRefineParams
} from './claude-agent-service';

// Re-export types so consumers can import from either service
export type {
  TemplateRefinedSection,
  SectionRefinementResult,
  StreamGenerateParams,
  StructureCreationParams,
  StructureCreationResult,
  StreamEvent,
  InlineRefineParams
};

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

// ---------------------------------------------------------------------------
// Debug logging
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Codex CLI path resolution
// ---------------------------------------------------------------------------

function resolveCodexBinary(): string {
  // Check common locations for the codex binary
  const candidates = [
    path.resolve(process.cwd(), '..', '..', 'node_modules', '.bin', 'codex'),
    path.resolve(process.cwd(), 'node_modules', '.bin', 'codex'),
    'codex' // Fall back to PATH
  ];

  return candidates[0]; // Use workspace root node_modules first
}

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

export function isCodexAvailable(): boolean {
  return appConfig.enableCodexAgent;
}

/**
 * Log Codex authentication status at startup
 */
export function logCodexAuthStatus(): void {
  if (!appConfig.enableCodexAgent) {
    // eslint-disable-next-line no-console
    console.log('  Codex Agent: Disabled (ENABLE_CODEX_AGENT=false)');
    return;
  }

  const hasApiKey = Boolean(appConfig.openaiApiKey || process.env.OPENAI_API_KEY);
  const model = appConfig.codexModel || 'default';

  if (hasApiKey) {
    // eslint-disable-next-line no-console
    console.log(`✓ Codex Agent: API key configured (model: ${model})`);
  } else {
    // eslint-disable-next-line no-console
    console.log('✓ Codex Agent: Enabled (using default Codex authentication - ChatGPT login)');
  }
}

// ---------------------------------------------------------------------------
// JSONL event types from Codex CLI --json output
// ---------------------------------------------------------------------------

interface CodexJsonEvent {
  type: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Core Codex CLI execution helper
// ---------------------------------------------------------------------------

interface CodexExecOptions {
  prompt: string;
  cwd?: string;
  additionalDirs?: string[];
  sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access';
  outputLastMessage?: string;
  json?: boolean;
  model?: string;
}

function buildCodexArgs(options: CodexExecOptions): string[] {
  const args: string[] = ['exec'];

  if (options.cwd) {
    args.push('--cd', options.cwd);
  }

  if (options.additionalDirs) {
    for (const dir of options.additionalDirs) {
      args.push('--add-dir', dir);
    }
  }

  if (options.sandbox) {
    args.push('-s', options.sandbox);
  }

  if (options.json) {
    args.push('--json');
  }

  if (options.outputLastMessage) {
    args.push('-o', options.outputLastMessage);
  }

  const model = options.model || appConfig.codexModel;
  if (model) {
    args.push('-m', model);
  }

  // Use --dangerously-bypass-approvals-and-sandbox for non-interactive server use
  args.push('--dangerously-bypass-approvals-and-sandbox');
  args.push('--skip-git-repo-check');
  args.push('--ephemeral');

  // The prompt is the last argument
  args.push(options.prompt);

  return args;
}

function spawnCodex(options: CodexExecOptions): ChildProcess {
  const codexBin = resolveCodexBinary();
  const args = buildCodexArgs(options);

  codexDebugLog('Spawning codex', { bin: codexBin, args: args.slice(0, -1).concat(['<prompt>']) });

  const env: Record<string, string> = { ...process.env as Record<string, string> };
  if (appConfig.openaiApiKey) {
    env.OPENAI_API_KEY = appConfig.openaiApiKey;
  }

  return spawn(codexBin, args, {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: options.cwd || process.cwd()
  });
}

/**
 * Run Codex CLI exec and collect full output
 */
async function runCodexExec(options: CodexExecOptions): Promise<{
  output: string;
  events: CodexJsonEvent[];
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawnCodex({ ...options, json: true });

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const events: CodexJsonEvent[] = [];

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdoutChunks.push(text);

      // Parse JSONL events
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed) as CodexJsonEvent;
          events.push(event);
        } catch {
          // Not JSON, just raw output
        }
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderrChunks.push(data.toString());
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to spawn Codex CLI: ${error.message}`));
    });

    child.on('close', (code) => {
      const output = stdoutChunks.join('');
      const stderr = stderrChunks.join('');

      if (code !== 0 && code !== null) {
        codexDebugLog('Codex exit code', code);
        codexDebugLog('Codex stderr', stderr);
        // Don't reject on non-zero exit - Codex may still have produced useful output
      }

      resolve({ output, events, stderr });
    });
  });
}

/**
 * Run Codex CLI exec and stream JSONL events as they arrive
 */
async function* streamCodexExec(options: CodexExecOptions): AsyncGenerator<CodexJsonEvent> {
  const child = spawnCodex({ ...options, json: true });

  let buffer = '';

  const eventQueue: CodexJsonEvent[] = [];
  let resolveWaiting: (() => void) | null = null;
  let done = false;
  let error: Error | null = null;

  child.stdout?.on('data', (data: Buffer) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete last line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed) as CodexJsonEvent;
        eventQueue.push(event);
        if (resolveWaiting) {
          resolveWaiting();
          resolveWaiting = null;
        }
      } catch {
        // Not JSON, skip
      }
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    codexDebugLog('Codex stderr', data.toString());
  });

  child.on('error', (err) => {
    error = new Error(`Codex CLI error: ${err.message}`);
    done = true;
    if (resolveWaiting) {
      resolveWaiting();
      resolveWaiting = null;
    }
  });

  child.on('close', () => {
    // Process any remaining buffer
    if (buffer.trim()) {
      try {
        const event = JSON.parse(buffer.trim()) as CodexJsonEvent;
        eventQueue.push(event);
      } catch {
        // Not JSON
      }
    }
    done = true;
    if (resolveWaiting) {
      resolveWaiting();
      resolveWaiting = null;
    }
  });

  while (true) {
    while (eventQueue.length > 0) {
      yield eventQueue.shift()!;
    }

    if (done) break;
    if (error) throw error;

    // Wait for more events
    await new Promise<void>((resolve) => {
      resolveWaiting = resolve;
    });
  }

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Extract text content from Codex JSONL events
// ---------------------------------------------------------------------------

function extractTextFromEvents(events: CodexJsonEvent[]): string {
  const fragments: string[] = [];

  for (const event of events) {
    // Codex emits various event types; extract text content
    if (event.type === 'message' && typeof event.content === 'string') {
      fragments.push(event.content);
    }
    if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
      fragments.push(event.delta);
    }
    if (event.type === 'response.output_text.done' && typeof event.text === 'string') {
      fragments.push(event.text);
    }
    // Handle assistant messages with content array
    if (event.type === 'response.completed') {
      const response = event.response as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> } | undefined;
      if (response?.output) {
        for (const item of response.output) {
          if (item.type === 'message' && Array.isArray(item.content)) {
            for (const block of item.content) {
              if (block.type === 'output_text' && typeof block.text === 'string') {
                fragments.push(block.text);
              }
            }
          }
        }
      }
    }
  }

  return fragments.join('');
}

// ---------------------------------------------------------------------------
// Prompt builders (mirrors claude-agent-service.ts prompts)
// ---------------------------------------------------------------------------

function buildAgenticGeneratePrompt({ sectionTitle, userPrompt, snippets }: GenerateParams): string {
  const sourceContext = snippets.length > 0
    ? snippets.map((snippet) => {
        const warningText = snippet.warnings?.length ? ` [Warnings: ${snippet.warnings.join('; ')}]` : '';
        const excerpt = snippet.content ? `\n  Excerpt:\n  ${snippet.content.replace(/\n/g, '\n  ')}` : '';
        return `- ${snippet.name}${warningText}\n  ID: ${snippet.id}\n  Path: ${snippet.absolutePath}${excerpt}`;
      }).join('\n')
    : 'No source documents selected.';

  return `You are an expert regulatory affairs writer assisting with drafting section "${sectionTitle}" for a regulatory dossier.

Task: Generate well-structured markdown content for this section based on the analyst's instructions and available source documents.

Section: ${sectionTitle}

Analyst Instructions:
${userPrompt}

Available Source Documents:
${sourceContext}

${snippets.length > 0 ? `Source files are available at the paths listed below. Read the relevant source documents to extract relevant information.

Process:
1. Review the analyst instructions and understand what content is needed
2. If sources are provided, read the relevant source documents to gather information
3. Draft clear, concise, and well-structured content that addresses the requirements
4. Ensure all claims are grounded in the source materials when sources are provided
5. Format the output as clean markdown

Important:
- Only include information that is relevant to the section requirements
- When using source information, ensure accuracy and proper context
- If sources are missing key information, note this in your response
- Keep the tone professional and appropriate for regulatory documentation
` : `No source documents were provided. Please provide general guidance or placeholder content for this section based on the analyst instructions and typical regulatory dossier requirements.
`}
Return your generated content as markdown. Do not include explanations about the process - only the final section content.`;
}

function buildStreamingGeneratePrompt({ sectionTitle, userPrompt, sourceFiles, mentionedFiles, programPath, targetPath }: StreamGenerateParams): string {
  const mentionedContext = mentionedFiles?.length
    ? `\nThe author specifically referenced these files (prioritize them):\n${mentionedFiles.map((f) => `- ${f.name}: ${f.absolutePath}`).join('\n')}\n`
    : '';

  const selectedSourcesHint = sourceFiles.length > 0
    ? `\nThe author selected these source documents:\n${sourceFiles.map((f) => `- ${f.name}: ${f.absolutePath}`).join('\n')}\n`
    : '';

  const writeBlock = targetPath && programPath
    ? `
After drafting, save the content to:
  ${programPath}/${targetPath}

Include YAML frontmatter:
---
title: "${sectionTitle}"
status: draft
generatedAt: "${new Date().toISOString()}"
sources: []
---
Then the full markdown content.
`
    : '';

  return `You are an expert regulatory affairs writer. Your task is to draft section "${sectionTitle}" for a regulatory dossier.

Author's instructions:
${userPrompt}
${mentionedContext}${selectedSourcesHint}
**CONTEXT DISCOVERY - do this before writing:**

1. Read \`program.json\` in the current directory to understand the full document structure, section hierarchy, and which sections already exist.
2. Look for a template document (check \`template/\` folder). If a PDF exists, read or parse it to understand what this section should contain according to the template.
3. Check if neighboring/sibling sections already have \`content.md\` files. Read 2-3 of them to match tone, depth, and formatting conventions already established in this dossier.
4. Check the \`sources/\` folder for uploaded reference documents. Read any that are relevant to this section's topic.

**WRITING GUIDELINES:**

- Follow ICH/regulatory writing conventions appropriate for this section type
- Match the style and depth of any existing sibling sections
- Ground claims in source documents when available; note gaps explicitly
- Use proper markdown formatting: headings, lists, tables where appropriate
- Be precise, evidence-based, and use appropriate scientific language
- Do NOT explain your process - output only the final section content as markdown
${writeBlock}`;
}

function buildInlineRefinePrompt(params: InlineRefineParams): string {
  const ACTION_INSTRUCTIONS: Record<string, string> = {
    improve: 'Improve the clarity, precision, and scientific quality of this text while preserving its meaning and key claims. Fix any grammatical issues, strengthen weak phrasing, and ensure regulatory-appropriate language.',
    expand: 'Expand this text with additional relevant detail, supporting evidence, and elaboration. Add depth while maintaining accuracy and regulatory tone. Roughly double the length.',
    simplify: 'Simplify this text to be clearer and more accessible while retaining all critical regulatory and scientific information. Reduce jargon where possible.',
    add_references: 'Add appropriate in-text citation placeholders (e.g., [Author, Year], [Ref X]) where claims need supporting references. Add a brief note at the end listing what types of references should be found for each citation.',
    rewrite: 'Completely rewrite this text with a fresh approach while conveying the same information. Use different sentence structures and phrasing. Maintain regulatory quality.',
    make_concise: 'Make this text more concise without losing critical information. Remove redundancy, tighten phrasing, and eliminate filler words. Target roughly half the original length.',
    formal_tone: 'Adjust the tone to be more formal and appropriate for regulatory submission documents. Ensure precise scientific language and passive voice where conventional.',
    custom: ''
  };

  const instruction = params.action === 'custom' && params.customInstruction
    ? params.customInstruction
    : ACTION_INSTRUCTIONS[params.action] || ACTION_INSTRUCTIONS.improve;

  const contextBlock = params.surroundingContext
    ? `\n\nSurrounding context for reference (do NOT include this in output):\n---\n${params.surroundingContext.slice(0, 2000)}\n---`
    : '';

  const sectionBlock = params.sectionTitle
    ? `\nSection: "${params.sectionTitle}"`
    : '';

  return `You are an expert regulatory affairs editor. Your task is to refine a selected passage from a regulatory dossier document.
${sectionBlock}${contextBlock}

Selected text to refine:
---
${params.selectedText}
---

Instruction: ${instruction}

RULES:
- Return ONLY the refined text. No explanations, no preamble, no markdown code fences.
- Preserve any existing markdown formatting (bold, italics, lists, headings).
- The output should be a drop-in replacement for the selected text.
- Maintain scientific accuracy and regulatory compliance.`;
}

function buildExtractedSectionsPrompt(headings: string[]): string {
  const numberedHeadings = headings.map((heading, index) => `${index + 1}. ${heading}`).join('\n');

  return `You are a regulatory affairs expert. Analyze these section headings and return a JSON object.

CRITICAL: Your response must be ONLY the JSON object, nothing else. No markdown, no explanations, no code fences.

Task: For each heading below, create an entry with:
- title: The heading text
- summary: Brief 2-3 sentence description of what this section should contain
- originalHeading: Copy of the original heading

JSON Format Required:
{
  "sections": [
    {
      "title": "1.1 Synopsis",
      "summary": "Provides a high-level overview of the study including objectives, design, patient population, primary endpoints, and key statistical methods.",
      "originalHeading": "1.1 Synopsis"
    }
  ]
}

Section headings to analyze:
${numberedHeadings}

Remember: Output ONLY the JSON object. Start with { and end with }. No other text.`;
}

function buildTemplateRefinementPrompt(templatePath: string): string {
  return `You are analyzing a regulatory document template to extract its complete section structure.

Template File: ${templatePath}

TASK: Extract ALL section headings from this PDF/DOCX template and return structured JSON with summaries.

STEP 1 - Read the Document:
Read the template file to see its full structure. If it's a PDF, try to parse it first.

STEP 2 - Extract Section Headings:
Identify ALL section headings in the document. Look for:
- Numbered sections (1., 1.1, 1.1.1, 2.6.2.1, etc.)
- Lettered sections (A., B.1, etc.)
- Title sections
- Nested hierarchies

STEP 3 - Create Structured Output:
For EACH section heading, provide:
- title: The section heading exactly as it appears
- summary: 2-3 sentence description of what this section should contain (use regulatory terminology)
- originalHeading: Copy of the exact heading text

STEP 4 - Return JSON:
Output ONLY the JSON object below. NO markdown fences, NO explanations.

{
  "sections": [
    {
      "title": "1.1 Synopsis",
      "summary": "Provides a high-level overview of the study including objectives, design, patient population, primary endpoints, and key statistical methods.",
      "originalHeading": "1.1 Synopsis"
    }
  ]
}

IMPORTANT REQUIREMENTS:
- Extract ALL sections (don't truncate or limit)
- Return ONLY the JSON object
- Start output with { and end with }
- NO markdown code fences
- If you cannot parse the file, return {"sections": []}

Begin by reading the template file.`;
}

function buildStructureCreationPrompt(params: StructureCreationParams): string {
  const sectionsJson = JSON.stringify(params.sections, null, 2);
  const timestamp = new Date().toISOString();

  return `You are setting up the folder structure for a regulatory dossier program.

PROGRAM FOLDER: ${params.programPath}
SECTIONS TO CREATE: ${params.sections.length}

Here are the sections extracted from the template:
${sectionsJson}

TASK: Create an appropriate folder hierarchy for these sections.

INSTRUCTIONS:
1. Analyze the numeric prefixes in section titles (e.g., "2", "2.3", "2.3.1").
2. ALWAYS create a nested folder hierarchy that mirrors the numeric hierarchy:
   - Example: "2.3.1 Risk Assessment" => "2-Introduction/2-3-Benefit-Risk-Assessment/2-3-1-Risk-Assessment/content.md"
3. Use the numeric prefix at every folder level to preserve order.
4. If a title has no numeric prefix, place it under a "00-Front-Sections" folder.
5. For each section, create a content.md file with YAML frontmatter:

---
title: "{section title}"
originalHeading: "{original heading from template}"
status: pending
createdAt: "${timestamp}"
---

# {section title}

{summary from the section data}

<!-- Content will be generated here -->

6. Use a SINGLE shell command to create ALL directories and files.
   - Build one multi-line bash script that runs all mkdir -p and file writes.
   - Do NOT run verification commands (no find/ls/count checks).

After creating all files, output a JSON summary:
{
  "structure": "flat" or "nested",
  "sectionRoot": "name of root folder if nested, or null if flat",
  "files": [
    {"path": "relative/path/to/content.md", "section": "1.1 Synopsis"}
  ]
}

IMPORTANT:
- Create files directly in ${params.programPath}, not in a subdirectory unless using nested structure
- Output ONLY the final JSON summary after creating all files
- Start JSON with { and end with }`;
}

// ---------------------------------------------------------------------------
// JSON parsing helpers (shared with claude-agent-service.ts patterns)
// ---------------------------------------------------------------------------

function extractJsonCandidate(output: string): string | null {
  if (!output) return null;

  const codeBlockMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim();

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

function parseRefinementOutput(
  output: string
): Array<{ title?: unknown; summary?: unknown; originalHeading?: unknown }> | null {
  const candidate = extractJsonCandidate(output);
  if (!candidate) return null;

  try {
    const parsed = JSON.parse(candidate) as unknown;

    if (Array.isArray(parsed)) {
      return parsed as Array<{ title?: unknown; summary?: unknown; originalHeading?: unknown }>;
    }

    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { sections?: unknown }).sections)) {
      return (parsed as { sections: Array<{ title?: unknown; summary?: unknown; originalHeading?: unknown }> }).sections;
    }

    return null;
  } catch {
    return null;
  }
}

function parseStructureOutput(output: string): {
  filesCreated: Array<{ path: string; section: string }>;
  sectionRoot?: string;
  warnings?: string[];
} {
  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { filesCreated: [], warnings: ['No JSON found in output'] };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      structure?: string;
      sectionRoot?: string;
      files?: Array<{ path: string; section: string }>;
    };

    return {
      filesCreated: Array.isArray(parsed.files) ? parsed.files : [],
      sectionRoot: parsed.sectionRoot || undefined,
      warnings: undefined
    };
  } catch {
    return {
      filesCreated: [],
      warnings: ['Failed to parse structure creation output']
    };
  }
}

// ---------------------------------------------------------------------------
// Public API (mirrors claude-agent-service.ts exports)
// ---------------------------------------------------------------------------

const MAX_REFINEMENT_HEADINGS = 200;

/**
 * Generate section draft content using Codex CLI exec
 */
export async function generateDraft(params: GenerateParams): Promise<GenerateResult> {
  if (!isCodexAvailable()) {
    throw new Error('Codex Agent not available. Check configuration (ENABLE_CODEX_AGENT=true).');
  }

  const prompt = buildAgenticGeneratePrompt(params);

  try {
    codexDebugLog('Generate draft prompt', prompt.slice(0, 2000));

    const { events, stderr } = await runCodexExec({
      prompt,
      cwd: appConfig.sourceRoot,
      additionalDirs: [appConfig.sourceRoot],
      sandbox: params.snippets.length > 0 ? 'read-only' : 'read-only'
    });

    const content = extractTextFromEvents(events);

    if (!content.trim()) {
      // eslint-disable-next-line no-console
      console.error('Codex returned empty response. stderr:', stderr.slice(0, 500));
      throw new Error('Codex returned an empty response.');
    }

    return {
      content: content.trim(),
      metadata: {
        agentUsed: true,
        provider: 'codex',
        snippetCount: params.snippets.length
      },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } // Codex CLI doesn't expose token usage
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Codex generation failed:', error);
    throw error instanceof Error ? error : new Error('Codex generation failed.');
  }
}

/**
 * Streaming content generation using Codex CLI exec with JSONL output
 */
export async function* generateDraftStream(params: StreamGenerateParams): AsyncGenerator<StreamEvent> {
  if (!isCodexAvailable()) {
    yield { type: 'error', error: 'Codex Agent not available. Check configuration (ENABLE_CODEX_AGENT=true).' };
    return;
  }

  const prompt = buildStreamingGeneratePrompt(params);

  const directories = [appConfig.sourceRoot, appConfig.templateRoot];
  if (params.programPath) {
    directories.push(params.programPath);
  }

  try {
    codexDebugLog('Streaming generate prompt', prompt.slice(0, 2000));

    const sandbox = (params.programPath && params.targetPath)
      ? 'workspace-write' as const
      : 'read-only' as const;

    const fragments: string[] = [];

    for await (const event of streamCodexExec({
      prompt,
      cwd: params.programPath || appConfig.sourceRoot,
      additionalDirs: directories,
      sandbox
    })) {
      // Map Codex JSONL events to our StreamEvent format
      if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
        fragments.push(event.delta);
        yield { type: 'text', content: event.delta };
      }

      if (event.type === 'function_call' || event.type === 'tool_call') {
        const name = typeof event.name === 'string' ? event.name : 'unknown';
        yield { type: 'tool_start', tool: name, input: event.arguments ?? event.input };
      }

      if (event.type === 'function_call_output' || event.type === 'tool_result') {
        yield {
          type: 'tool_result',
          tool: typeof event.name === 'string' ? event.name : undefined,
          output: typeof event.output === 'string' ? event.output.slice(0, 500) : undefined
        };
      }

      if (event.type === 'response.completed') {
        const content = extractTextFromEvents([event]) || fragments.join('');
        yield {
          type: 'complete',
          content: content.trim() || 'Codex completed but returned no content.',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
        };
        return;
      }

      if (event.type === 'error') {
        yield {
          type: 'error',
          error: typeof event.message === 'string' ? event.message : 'Codex returned an error.'
        };
        return;
      }
    }

    // Fallback if no explicit completion event
    const content = fragments.join('').trim();
    yield {
      type: 'complete',
      content: content || 'Codex completed but returned no content.',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Codex streaming generation failed:', error);
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Inline text refinement using Codex CLI
 */
export async function* refineInlineStream(params: InlineRefineParams): AsyncGenerator<StreamEvent> {
  if (!isCodexAvailable()) {
    yield { type: 'error', error: 'Codex Agent not available. Check configuration (ENABLE_CODEX_AGENT=true).' };
    return;
  }

  const prompt = buildInlineRefinePrompt(params);

  try {
    codexDebugLog('Inline refine prompt', prompt.slice(0, 1000));

    const fragments: string[] = [];

    for await (const event of streamCodexExec({
      prompt,
      sandbox: 'read-only'
    })) {
      if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
        fragments.push(event.delta);
        yield { type: 'text', content: event.delta };
      }

      if (event.type === 'response.completed') {
        const content = extractTextFromEvents([event]) || fragments.join('');
        yield {
          type: 'complete',
          content: content.trim(),
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
        };
        return;
      }
    }

    const fullContent = fragments.join('');
    yield { type: 'complete', content: fullContent, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Codex inline refinement failed:', error);
    yield { type: 'error', error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}

/**
 * Refine extracted template sections using Codex CLI
 */
export async function refineExtractedSections(headings: string[]): Promise<SectionRefinementResult> {
  const normalizedHeadings = headings.map((h) => h?.trim()).filter(Boolean) as string[];

  if (!normalizedHeadings.length) {
    return {
      sections: [],
      warnings: ['No headings available for Codex refinement.'],
      claudeUsed: false,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  }

  const exceedsLimit = normalizedHeadings.length > MAX_REFINEMENT_HEADINGS;
  const headingsForCodex = exceedsLimit ? normalizedHeadings.slice(0, MAX_REFINEMENT_HEADINGS) : normalizedHeadings;

  if (!isCodexAvailable()) {
    throw new Error('Codex Agent not available. Check configuration (ENABLE_CODEX_AGENT=true).');
  }

  const prompt = buildExtractedSectionsPrompt(headingsForCodex);

  try {
    codexDebugLog('Refine extracted sections prompt', prompt);

    const { events } = await runCodexExec({
      prompt,
      sandbox: 'read-only'
    });

    const output = extractTextFromEvents(events);
    codexDebugLog('Refinement output received', output.slice(0, 2000));

    const parsed = parseRefinementOutput(output);

    if (!parsed || parsed.length === 0) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse Codex refinement output. Raw output:', output.slice(0, 500));
      throw new Error('Codex did not return parseable section data.');
    }

    const sections = parsed
      .filter((entry) => {
        return (
          entry &&
          typeof entry === 'object' &&
          typeof entry.title === 'string' &&
          typeof entry.summary === 'string' &&
          typeof entry.originalHeading === 'string'
        );
      })
      .map((entry) => ({
        title: (entry.title as string).trim(),
        summary: (entry.summary as string).trim(),
        originalHeading: (entry.originalHeading as string).trim()
      }));

    const warnings: string[] = [];
    if (sections.length < normalizedHeadings.length) {
      const percentComplete = Math.round((sections.length / normalizedHeadings.length) * 100);
      warnings.push(`Codex refined ${sections.length} of ${normalizedHeadings.length} sections (${percentComplete}% complete).`);
    }
    if (exceedsLimit) {
      warnings.push(`Codex refinement limited to the first ${MAX_REFINEMENT_HEADINGS} sections.`);
    }

    return {
      sections,
      warnings: warnings.length > 0 ? warnings : undefined,
      claudeUsed: false, // Using Codex, not Claude
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Codex refinement failed:', error);
    throw error instanceof Error ? error : new Error('Codex refinement failed.');
  }
}

/**
 * Refine template sections by extracting from file using Codex CLI
 */
export async function refineTemplateSections(templatePath: string): Promise<SectionRefinementResult> {
  if (!isCodexAvailable()) {
    throw new Error('Codex Agent not available. Check configuration (ENABLE_CODEX_AGENT=true).');
  }

  const prompt = buildTemplateRefinementPrompt(templatePath);

  try {
    codexDebugLog('Template refinement prompt', prompt);

    const { events } = await runCodexExec({
      prompt,
      cwd: appConfig.templateRoot,
      additionalDirs: [appConfig.templateRoot],
      sandbox: 'read-only'
    });

    const output = extractTextFromEvents(events);
    codexDebugLog('Template refinement output', output);

    const parsed = parseRefinementOutput(output);

    if (!parsed || parsed.length === 0) {
      throw new Error('Codex agent did not return parseable section data.');
    }

    const sections = parsed
      .filter((entry) => {
        return (
          entry &&
          typeof entry === 'object' &&
          typeof entry.title === 'string' &&
          typeof entry.summary === 'string' &&
          typeof entry.originalHeading === 'string'
        );
      })
      .map((entry) => ({
        title: (entry.title as string).trim(),
        summary: (entry.summary as string).trim(),
        originalHeading: (entry.originalHeading as string).trim()
      }));

    // eslint-disable-next-line no-console
    console.log(`[Codex Agent] Template refinement complete: ${sections.length} sections extracted`);

    return {
      sections,
      warnings: undefined,
      claudeUsed: false,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Codex template refinement failed:', error);
    throw error instanceof Error ? error : new Error('Codex template refinement failed.');
  }
}

/**
 * Create folder structure for a program using Codex CLI
 */
export async function createProgramStructure(params: StructureCreationParams): Promise<StructureCreationResult> {
  if (!isCodexAvailable()) {
    throw new Error('Codex Agent not available. Check configuration (ENABLE_CODEX_AGENT=true).');
  }

  const prompt = buildStructureCreationPrompt(params);

  try {
    codexDebugLog('Structure creation prompt', prompt.slice(0, 2000));

    // eslint-disable-next-line no-console
    console.log('[Codex Agent] Creating program folder structure...');
    // eslint-disable-next-line no-console
    console.log('[Codex Agent] Program path:', params.programPath);
    // eslint-disable-next-line no-console
    console.log('[Codex Agent] Sections to create:', params.sections.length);

    const { events } = await runCodexExec({
      prompt,
      cwd: params.programPath,
      additionalDirs: [params.programPath],
      sandbox: 'workspace-write'
    });

    const output = extractTextFromEvents(events);
    codexDebugLog('Structure creation output', output);

    const parsed = parseStructureOutput(output);

    // eslint-disable-next-line no-console
    console.log(`[Codex Agent] Structure creation complete: ${parsed.filesCreated.length} files`);

    return {
      success: true,
      filesCreated: parsed.filesCreated,
      sectionRoot: parsed.sectionRoot,
      warnings: parsed.warnings,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Codex structure creation failed:', error);
    throw error instanceof Error ? error : new Error('Codex structure creation failed.');
  }
}
