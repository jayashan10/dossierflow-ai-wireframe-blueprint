import { query } from '@anthropic-ai/claude-agent-sdk';
import { appConfig } from '../config';
import type { SourceSnippet, SourceFileRef } from './source-service';

export interface TemplateRefinedSection {
  title: string;
  summary: string;
  originalHeading: string;
}

export interface SectionRefinementResult {
  sections: TemplateRefinedSection[];
  warnings?: string[];
  claudeUsed: boolean;
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

// Streaming generation types
export interface StreamGenerateParams {
  sectionTitle: string;
  userPrompt: string;
  sourceFiles: SourceFileRef[];
  mentionedFiles?: SourceFileRef[];
  // Optional: write to program file
  programPath?: string;  // Absolute path to program folder
  targetPath?: string;   // Relative path within program (e.g., "1-Introduction/content.md")
}

// Structure creation types
export interface StructureCreationParams {
  programPath: string;
  sections: Array<{ title: string; summary?: string; originalHeading?: string }>;
}

export interface StructureCreationResult {
  success: boolean;
  filesCreated: Array<{ path: string; section: string }>;
  sectionRoot?: string;
  warnings?: string[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface StreamEvent {
  type: 'text' | 'tool_start' | 'tool_result' | 'thinking' | 'complete' | 'error';
  content?: string;
  tool?: string;
  input?: unknown;
  output?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  error?: string;
}

type ClaudeUsagePayload = {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
};

type ClaudeUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

const isClaudeDebugEnabled = (() => {
  const flag = process.env.CLAUDE_DEBUG;
  if (!flag) return false;
  return flag === '1' || flag.toLowerCase() === 'true';
})();

function claudeDebugLog(label: string, payload: unknown) {
  if (!isClaudeDebugEnabled) return;
  try {
    const formatted = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    // eslint-disable-next-line no-console
    console.log(`[Claude Debug] ${label}:`, formatted);
  } catch {
    // eslint-disable-next-line no-console
    console.log(`[Claude Debug] ${label}:`, payload);
  }
}

// Model is automatically selected by Claude Agent SDK (uses latest available)

if (appConfig.anthropicApiKey && process.env.ANTHROPIC_API_KEY !== appConfig.anthropicApiKey) {
  process.env.ANTHROPIC_API_KEY = appConfig.anthropicApiKey;
}

if (appConfig.anthropicBaseUrl && process.env.ANTHROPIC_BASE_URL !== appConfig.anthropicBaseUrl) {
  process.env.ANTHROPIC_BASE_URL = appConfig.anthropicBaseUrl;
}

if (appConfig.anthropicAuthToken && process.env.ANTHROPIC_AUTH_TOKEN !== appConfig.anthropicAuthToken) {
  process.env.ANTHROPIC_AUTH_TOKEN = appConfig.anthropicAuthToken;
}

if (appConfig.anthropicCustomHeaders && process.env.ANTHROPIC_CUSTOM_HEADERS !== appConfig.anthropicCustomHeaders) {
  process.env.ANTHROPIC_CUSTOM_HEADERS = appConfig.anthropicCustomHeaders;
}

if (typeof appConfig.claudeUseBedrock === 'boolean') {
  process.env.CLAUDE_CODE_USE_BEDROCK = appConfig.claudeUseBedrock ? '1' : '0';
}

if (typeof appConfig.claudeUseVertex === 'boolean') {
  process.env.CLAUDE_CODE_USE_VERTEX = appConfig.claudeUseVertex ? '1' : '0';
}


/**
 * Check if Claude is available
 * The SDK handles authentication with its default provider - only check if feature is enabled
 */
function isClaudeAvailable(): boolean {
  return appConfig.enableClaudeAgent;
}

/**
 * Log Claude authentication status at startup
 */
export function logClaudeAuthStatus(): void {
  if (!appConfig.enableClaudeAgent) {
    // eslint-disable-next-line no-console
    console.log('⚠ Claude Agent: Disabled (ENABLE_CLAUDE_AGENT=false)');
    return;
  }

  const hasApiKey = Boolean(appConfig.anthropicApiKey || process.env.ANTHROPIC_API_KEY);
  const hasAuthToken = Boolean(appConfig.anthropicAuthToken || process.env.ANTHROPIC_AUTH_TOKEN);
  const baseUrl = appConfig.anthropicBaseUrl || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';

  if (hasApiKey) {
    // eslint-disable-next-line no-console
    console.log('✓ Claude Agent: API key configured');
    // eslint-disable-next-line no-console
    console.log(`  Endpoint: ${baseUrl}`);
  } else if (hasAuthToken) {
    // eslint-disable-next-line no-console
    console.log('✓ Claude Agent: Proxy auth token configured');
    // eslint-disable-next-line no-console
    console.log(`  Endpoint: ${baseUrl}`);
    // eslint-disable-next-line no-console
    console.log(`  Auth Token: ${hasAuthToken ? '***' + appConfig.anthropicAuthToken?.slice(-10) : 'not set'}`);
  } else if (appConfig.claudeUseBedrock) {
    // eslint-disable-next-line no-console
    console.log('✓ Claude Agent: Bedrock integration enabled (using AWS credentials)');
  } else if (appConfig.claudeUseVertex) {
    // eslint-disable-next-line no-console
    console.log('✓ Claude Agent: Vertex AI integration enabled (using GCP credentials)');
  } else {
    // eslint-disable-next-line no-console
    console.log('✓ Claude Agent: Enabled (using default SDK authentication)');
  }
}

const MAX_REFINEMENT_HEADINGS = 200; // Allow more sections for full template processing

function parseRefinementOutput(
  output: string
): Array<{ title?: unknown; summary?: unknown; originalHeading?: unknown }> | null {
  const candidate = extractJsonCandidate(output);
  if (!candidate) {
    // eslint-disable-next-line no-console
    console.error('No JSON candidate found in output. First 300 chars:', output.slice(0, 300));
    claudeDebugLog('Full output with no JSON candidate', output);
    return null;
  }

  claudeDebugLog('Extracted JSON candidate length', candidate.length);
  claudeDebugLog('JSON candidate preview', candidate.slice(0, 1000));

  // Try parsing the raw candidate first - it might already be valid JSON
  try {
    const parsed = JSON.parse(candidate) as unknown;
    claudeDebugLog('JSON parsed successfully without sanitization', true);

    if (Array.isArray(parsed)) {
      return parsed as Array<{ title?: unknown; summary?: unknown; originalHeading?: unknown }>;
    }

    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { sections?: unknown }).sections)) {
      return (parsed as { sections: Array<{ title?: unknown; summary?: unknown; originalHeading?: unknown }> }).sections;
    }

    // eslint-disable-next-line no-console
    console.error('Parsed JSON is not in expected format:', typeof parsed, Array.isArray(parsed));
    return null;
  } catch (firstError) {
    // Raw JSON parsing failed, try sanitizing
    claudeDebugLog('Initial parse failed, attempting sanitization', firstError instanceof Error ? firstError.message : String(firstError));
  }

  // If raw parsing failed, try sanitizing and parsing again
  try {
    const cleaned = sanitizeJsonCandidate(candidate);
    claudeDebugLog('Sanitized JSON length', cleaned.length);

    const parsed = JSON.parse(cleaned) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as Array<{ title?: unknown; summary?: unknown; originalHeading?: unknown }>;
    }

    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { sections?: unknown }).sections)) {
      return (parsed as { sections: Array<{ title?: unknown; summary?: unknown; originalHeading?: unknown }> }).sections;
    }

    // eslint-disable-next-line no-console
    console.error('Parsed JSON is not in expected format:', typeof parsed, Array.isArray(parsed));
    return null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to parse Claude refinement output as JSON:', error);
    // eslint-disable-next-line no-console
    console.error('Candidate JSON length:', candidate.length, 'chars');
    // eslint-disable-next-line no-console
    console.error('Error occurred at position:', error instanceof SyntaxError ? (error.message.match(/position (\d+)/) || [])[1] : 'unknown');
    claudeDebugLog('Full candidate JSON that failed to parse', candidate);

    // Try to extract at least partial sections if we have some valid data
    const cleaned = sanitizeJsonCandidate(candidate);
    claudeDebugLog('Sanitized candidate (attempted fix)', cleaned);

    return null;
  }
}

function extractJsonCandidate(output: string): string | null {
  if (!output) {
    return null;
  }

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

function sanitizeJsonCandidate(candidate: string): string {
  let normalized = candidate.trim();

  // Replace smart quotes with standard quotes
  normalized = normalized.replace(/[\u201c\u201d\u201e\u201f\u2033\u2036]/g, '"');
  normalized = normalized.replace(/[\u2018\u2019\u201a\u201b\u2032\u2035]/g, "'");

  // Quote unquoted keys: {key: => {"key":
  normalized = normalized.replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":');

  // Replace single-quoted strings with double quotes when safe
  normalized = normalized.replace(/'([^']*)'/g, (_, value) => `"${value.replace(/"/g, '\\"')}"`);

  // Fix truncated JSON: if it doesn't end properly, try to close it
  if (!normalized.endsWith('}')) {
    // Find the last complete object in the sections array
    const lastCompleteObjectMatch = normalized.lastIndexOf('}');
    if (lastCompleteObjectMatch !== -1) {
      // Truncate to last complete object and close the array and main object
      normalized = normalized.substring(0, lastCompleteObjectMatch + 1);

      // Count opening and closing brackets/braces to determine what to close
      const openBrackets = (normalized.match(/\[/g) || []).length;
      const closeBrackets = (normalized.match(/\]/g) || []).length;
      const openBraces = (normalized.match(/\{/g) || []).length;
      const closeBraces = (normalized.match(/\}/g) || []).length;

      // Close any unclosed brackets
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        normalized += ']';
      }

      // Close any unclosed braces
      for (let i = 0; i < openBraces - closeBraces; i++) {
        normalized += '}';
      }
    }
  }

  // Remove trailing commas before closing brackets/braces
  normalized = normalized.replace(/,(\s*[}\]])/g, '$1');

  return normalized;
}

function normalizeUsage(payload?: ClaudeUsagePayload): ClaudeUsage {
  const promptTokens = (payload?.input_tokens ?? 0) + (payload?.cached_input_tokens ?? 0);
  const completionTokens = payload?.output_tokens ?? 0;
  const totalTokens = promptTokens + completionTokens;

  return { promptTokens, completionTokens, totalTokens };
}

/**
 * Build prompt for agentic content generation
 */
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

${snippets.length > 0 ? `You have access to the following tools:
- Read: Read source document files to extract relevant information
- Bash: Execute commands if needed for document processing

Source files are available at the paths listed below. Use the Read tool to access specific source documents and extract relevant information.

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

/**
 * Generate section draft content using agentic workflow
 */
export async function generateDraft(params: GenerateParams): Promise<GenerateResult> {
  if (!isClaudeAvailable()) {
    throw new Error('Claude Agent not available. Check configuration.');
  }

  const prompt = buildAgenticGeneratePrompt(params);

  try {
    claudeDebugLog('Generate draft prompt', prompt.slice(0, 2000));

    const agentQuery = query({
      prompt,
      options: {
        maxTurns: appConfig.agentMaxTurns,
        allowedTools: appConfig.agentEnableTools && params.snippets.length > 0 ? ['Skill', 'Read', 'Bash'] : [],
        settingSources: ['project'],
        cwd: appConfig.sourceRoot,
        additionalDirectories: [appConfig.sourceRoot],
        permissionMode: 'bypassPermissions'
      }
    });

    const fragments: string[] = [];
    const toolsUsed = new Set<string>();
    let turnsCompleted = 0;
    let usage: ClaudeUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    // eslint-disable-next-line no-restricted-syntax
    for await (const message of agentQuery as AsyncIterable<Record<string, unknown>>) {
      const messageType = typeof message?.type === 'string' ? (message.type as string) : 'unknown';
      claudeDebugLog('Agent message type', messageType);

      if (messageType === 'assistant') {
        turnsCompleted += 1;
        const assistantMessage = message as {
          message?: {
            content?: Array<{ type?: string; text?: string; name?: string }>;
          };
        };
        const assistantContent = assistantMessage.message?.content;

        if (Array.isArray(assistantContent)) {
          for (const block of assistantContent) {
            if (block?.type === 'text' && typeof block.text === 'string') {
              fragments.push(block.text);
            }
            if (block?.type === 'tool_use' && typeof block.name === 'string') {
              toolsUsed.add(block.name);
              claudeDebugLog(`Agent used tool: ${block.name}`, block);
            }
          }
        }
      }

      if (messageType === 'result') {
        const resultMessage = message as {
          subtype?: string;
          result?: string;
          usage?: ClaudeUsagePayload;
          error?: { message?: string };
        };

        if (resultMessage.usage) {
          const turnUsage = normalizeUsage(resultMessage.usage);
          usage.promptTokens += turnUsage.promptTokens;
          usage.completionTokens += turnUsage.completionTokens;
          usage.totalTokens += turnUsage.totalTokens;
        }

        if (resultMessage.subtype === 'success') {
          const content = typeof resultMessage.result === 'string' && resultMessage.result.trim().length
            ? resultMessage.result.trim()
            : fragments.join('').trim();

          return {
            content: content || 'Claude returned an empty response.',
            metadata: {
              agentUsed: true,
              snippetCount: params.snippets.length,
              toolsUsed: Array.from(toolsUsed),
              turnsCompleted
            },
            usage
          };
        }

        if (resultMessage.subtype === 'error') {
          const reason = resultMessage.error?.message ?? 'Agent returned an error result.';
          throw new Error(reason);
        }

        if (resultMessage.subtype === 'interrupted') {
          throw new Error('Agent run was interrupted before completion.');
        }
      }
    }

    // Fallback if no result received
    const content = fragments.join('').trim();
    return {
      content: content || 'Claude completed but returned no content.',
      metadata: {
        agentUsed: true,
        snippetCount: params.snippets.length,
        toolsUsed: Array.from(toolsUsed),
        turnsCompleted
      },
      usage
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Claude generation failed:', error);
    throw error instanceof Error ? error : new Error('Claude generation failed.');
  }
}

/**
 * Build prompt for streaming agentic content generation with direct file paths
 */
function buildStreamingGeneratePrompt({ sectionTitle, userPrompt, sourceFiles, mentionedFiles, programPath, targetPath }: StreamGenerateParams): string {
  const sourceContext = sourceFiles.length > 0
    ? sourceFiles.map((f) => `- ${f.name}: ${f.absolutePath}`).join('\n')
    : 'No source documents selected.';

  const mentionedContext = mentionedFiles?.length
    ? `\n\nSpecifically mentioned files (prioritize these):\n${mentionedFiles.map((f) => `- ${f.name}: ${f.absolutePath}`).join('\n')}`
    : '';

  // Add file write instructions if targetPath is provided
  const writeInstructions = targetPath && programPath
    ? `

**IMPORTANT - WRITE OUTPUT TO FILE:**
After generating the content, you MUST write it to:
  ${programPath}/${targetPath}

Use the Write tool to save the complete markdown content to this file.
The file should include YAML frontmatter:
---
title: "${sectionTitle}"
status: draft
generatedAt: "${new Date().toISOString()}"
sources: [${sourceFiles.map(f => `"${f.name}"`).join(', ')}]
---

Then include the generated content after the frontmatter.
`
    : '';

  return `You are an expert regulatory affairs writer assisting with drafting section "${sectionTitle}" for a regulatory dossier.

Task: Generate well-structured markdown content for this section based on the analyst's instructions and available source documents.

Section: ${sectionTitle}

Analyst Instructions:
${userPrompt}

Available Source Documents:
${sourceContext}${mentionedContext}

You have access to the following tools:
- Read: Read source document files to extract relevant information. Use this to read the full content of any source file.
- Write: Write content to files
- Bash: Execute commands for document processing (e.g., semtools parse for PDFs)
- Glob: Search for files if needed

IMPORTANT: Use the Read tool to access source document content. The files are at the paths listed above - read them directly to get the full content.

Process:
1. Review the analyst instructions and understand what content is needed
2. Read the relevant source documents using the Read tool to gather information
3. If a file is a PDF, you can use 'parse <filepath>' via Bash to convert it to markdown first
4. Draft clear, concise, and well-structured content that addresses the requirements
5. Ensure all claims are grounded in the source materials
6. Format the output as clean markdown${writeInstructions}

Important:
- Read the source files to get actual content - don't make up information
- When using source information, ensure accuracy and proper context
- If sources are missing key information, note this in your response
- Keep the tone professional and appropriate for regulatory documentation

Return your generated content as markdown. Do not include explanations about the process - only the final section content.`;
}

/**
 * Streaming content generation using agentic workflow
 * Yields events as the agent processes
 */
export async function* generateDraftStream(params: StreamGenerateParams): AsyncGenerator<StreamEvent> {
  if (!isClaudeAvailable()) {
    yield {
      type: 'error',
      error: 'Claude Agent not available. Check configuration.'
    };
    return;
  }

  const prompt = buildStreamingGeneratePrompt(params);

  // Build directories list - include programPath if provided
  const directories = [appConfig.sourceRoot, appConfig.templateRoot];
  if (params.programPath) {
    directories.push(params.programPath);
  }

  // Include Write tool if we need to write to a file
  const tools: string[] = ['Skill', 'Read', 'Glob', 'Bash'];
  if (params.programPath && params.targetPath) {
    tools.push('Write');
  }

  try {
    claudeDebugLog('Streaming generate prompt', prompt.slice(0, 2000));

    const agentQuery = query({
      prompt,
      options: {
        maxTurns: appConfig.agentMaxTurns,
        allowedTools: tools,
        settingSources: ['project'],
        cwd: params.programPath || appConfig.sourceRoot,
        additionalDirectories: directories,
        permissionMode: 'bypassPermissions'
      }
    });

    const fragments: string[] = [];
    let usage: ClaudeUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    // eslint-disable-next-line no-restricted-syntax
    for await (const message of agentQuery as AsyncIterable<Record<string, unknown>>) {
      const messageType = typeof message?.type === 'string' ? (message.type as string) : 'unknown';
      claudeDebugLog('Stream message type', messageType);

      if (messageType === 'assistant') {
        const assistantMessage = message as {
          message?: {
            content?: Array<{ type?: string; text?: string; name?: string; input?: unknown }>;
          };
        };
        const assistantContent = assistantMessage.message?.content;

        if (Array.isArray(assistantContent)) {
          for (const block of assistantContent) {
            if (block?.type === 'text' && typeof block.text === 'string') {
              fragments.push(block.text);
              yield { type: 'text', content: block.text };
            }
            if (block?.type === 'tool_use' && typeof block.name === 'string') {
              yield {
                type: 'tool_start',
                tool: block.name,
                input: block.input
              };
              claudeDebugLog(`Stream tool use: ${block.name}`, block.input);
            }
          }
        }
      }

      if (messageType === 'tool_result') {
        const toolMessage = message as {
          tool?: string;
          output?: string;
        };
        yield {
          type: 'tool_result',
          tool: toolMessage.tool,
          output: typeof toolMessage.output === 'string' ? toolMessage.output.slice(0, 500) : undefined
        };
      }

      if (messageType === 'result') {
        const resultMessage = message as {
          subtype?: string;
          result?: string;
          usage?: ClaudeUsagePayload;
          error?: { message?: string };
        };

        if (resultMessage.usage) {
          const turnUsage = normalizeUsage(resultMessage.usage);
          usage.promptTokens += turnUsage.promptTokens;
          usage.completionTokens += turnUsage.completionTokens;
          usage.totalTokens += turnUsage.totalTokens;
        }

        if (resultMessage.subtype === 'success') {
          const content = typeof resultMessage.result === 'string' && resultMessage.result.trim().length
            ? resultMessage.result.trim()
            : fragments.join('').trim();

          yield {
            type: 'complete',
            content: content || 'Claude returned an empty response.',
            usage
          };
          return;
        }

        if (resultMessage.subtype === 'error') {
          yield {
            type: 'error',
            error: resultMessage.error?.message ?? 'Agent returned an error.'
          };
          return;
        }

        if (resultMessage.subtype === 'interrupted') {
          yield {
            type: 'error',
            error: 'Agent run was interrupted before completion.'
          };
          return;
        }
      }
    }

    // Fallback if no result received
    const content = fragments.join('').trim();
    yield {
      type: 'complete',
      content: content || 'Claude completed but returned no content.',
      usage
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Streaming generation failed:', error);
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Refine extracted template sections using agentic workflow
 * Takes already-extracted headings and refines them with contextual summaries
 */
export async function refineExtractedSections(headings: string[]): Promise<SectionRefinementResult> {
  const normalizedHeadings = headings.map((heading) => heading?.trim()).filter((heading) => Boolean(heading)) as string[];

  if (!normalizedHeadings.length) {
    return {
      sections: [],
      warnings: ['No headings available for Claude refinement.'],
      claudeUsed: false,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  }

  const exceedsLimit = normalizedHeadings.length > MAX_REFINEMENT_HEADINGS;
  const headingsForClaude = exceedsLimit ? normalizedHeadings.slice(0, MAX_REFINEMENT_HEADINGS) : normalizedHeadings;

  if (!isClaudeAvailable()) {
    throw new Error('Claude Agent not available. Check configuration.');
  }

  const prompt = buildExtractedSectionsPrompt(headingsForClaude);

  try {
    claudeDebugLog('Refine extracted sections prompt', prompt);

    // eslint-disable-next-line no-console
    console.log('[Claude Agent] Calling API endpoint:', process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com');
    // eslint-disable-next-line no-console
    console.log('[Claude Agent] Auth method:', process.env.ANTHROPIC_AUTH_TOKEN ? 'Proxy Token' : 'API Key');

    const agentQuery = query({
      prompt,
      options: {
        maxTurns: appConfig.agentMaxTurns,
        allowedTools: appConfig.agentEnableTools ? ['Skill'] : [],
        settingSources: ['project'],
        permissionMode: 'bypassPermissions'
      }
    });

    const fragments: string[] = [];
    let usage: ClaudeUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    // eslint-disable-next-line no-restricted-syntax
    for await (const message of agentQuery as AsyncIterable<Record<string, unknown>>) {
      const messageType = typeof message?.type === 'string' ? (message.type as string) : 'unknown';

      if (messageType === 'assistant') {
        const assistantMessage = message as { message?: { content?: Array<{ type?: string; text?: string }> } };
        const assistantContent = assistantMessage.message?.content;

        if (Array.isArray(assistantContent)) {
          for (const block of assistantContent) {
            if (block?.type === 'text' && typeof block.text === 'string') {
              fragments.push(block.text);
            }
          }
        }
      }

      if (messageType === 'result') {
        const resultMessage = message as {
          subtype?: string;
          result?: string;
          usage?: ClaudeUsagePayload;
          error?: { message?: string };
        };

        if (resultMessage.usage) {
          const turnUsage = normalizeUsage(resultMessage.usage);
          usage.promptTokens += turnUsage.promptTokens;
          usage.completionTokens += turnUsage.completionTokens;
          usage.totalTokens += turnUsage.totalTokens;
        }

        if (resultMessage.subtype === 'success') {
          const output = typeof resultMessage.result === 'string' && resultMessage.result.trim().length
            ? resultMessage.result
            : fragments.join('');

          claudeDebugLog('Refinement output received', output.slice(0, 2000));

          const parsed = parseRefinementOutput(output);

          if (!parsed || parsed.length === 0) {
            // eslint-disable-next-line no-console
            console.error('Failed to parse Claude refinement output. Raw output:', output.slice(0, 500));
            throw new Error('Claude did not return parseable section data.');
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
            warnings.push(`Claude refined ${sections.length} of ${normalizedHeadings.length} sections (${percentComplete}% complete). Response may have been truncated.`);
          }
          if (exceedsLimit) {
            warnings.push(`Claude refinement limited to the first ${MAX_REFINEMENT_HEADINGS} sections.`);
          }

          return {
            sections,
            warnings: warnings.length > 0 ? warnings : undefined,
            claudeUsed: true,
            usage
          };
        }

        if (resultMessage.subtype === 'error') {
          const reason = resultMessage.error?.message ?? 'Agent returned an error result.';
          throw new Error(reason);
        }

        if (resultMessage.subtype === 'interrupted') {
          throw new Error('Agent run was interrupted before completion.');
        }
      }
    }

    throw new Error('Claude completed without returning section data.');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Claude refinement failed:', error);
    throw error instanceof Error ? error : new Error('Claude refinement failed.');
  }
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

/**
 * Refine template sections by extracting directly from file using agentic workflow with semtools
 */
export async function refineTemplateSections(templatePath: string): Promise<SectionRefinementResult> {
  if (!isClaudeAvailable()) {
    throw new Error('Claude Agent not available. Check configuration.');
  }

  // Use simpler prompt when Skills are enabled - let the Skill provide detailed instructions
  const prompt = appConfig.agentEnableTools
    ? buildSimpleRefinementPrompt(templatePath)
    : buildAgentRefinementPrompt(templatePath);

  try {
    claudeDebugLog('Agent refinement prompt', prompt);

    const allowedTools = appConfig.agentEnableTools ? ['Skill', 'Read', 'Glob', 'Bash'] : [];

    // eslint-disable-next-line no-console
    console.log('[Claude Agent] Starting template refinement with tools:', allowedTools);
    // eslint-disable-next-line no-console
    console.log('[Claude Agent] Working directory:', appConfig.templateRoot);
    // eslint-disable-next-line no-console
    console.log('[Claude Agent] Max turns:', appConfig.agentMaxTurns);

    const agentQuery = query({
      prompt,
      options: {
        maxTurns: appConfig.agentMaxTurns,
        allowedTools,
        settingSources: ['project'],
        cwd: appConfig.templateRoot,
        additionalDirectories: [appConfig.templateRoot],
        permissionMode: 'bypassPermissions'
      }
    });

    const fragments: string[] = [];
    let usage: ClaudeUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const toolsUsed = new Set<string>();
    let turnsCompleted = 0;

    // eslint-disable-next-line no-restricted-syntax
    for await (const message of agentQuery as AsyncIterable<Record<string, unknown>>) {
      const messageType = typeof message?.type === 'string' ? (message.type as string) : 'unknown';
      claudeDebugLog('Agent message type', messageType);

      if (messageType === 'assistant') {
        turnsCompleted += 1;
        const assistantMessage = message as {
          message?: {
            content?: Array<{ type?: string; text?: string; name?: string; input?: unknown }>;
          };
        };
        const assistantContent = assistantMessage.message?.content;

        if (Array.isArray(assistantContent)) {
          for (const block of assistantContent) {
            if (block?.type === 'text' && typeof block.text === 'string') {
              fragments.push(block.text);
            }
            if (block?.type === 'tool_use' && typeof block.name === 'string') {
              toolsUsed.add(block.name);
              // eslint-disable-next-line no-console
              console.log(`[Claude Agent] Using tool: ${block.name}`, block.input ? JSON.stringify(block.input).slice(0, 100) : '');
              claudeDebugLog(`Agent used tool: ${block.name}`, block);
            }
          }
        }
      }

      if (messageType === 'result') {
        const resultMessage = message as {
          subtype?: string;
          result?: string;
          usage?: ClaudeUsagePayload;
          error?: { message?: string };
        };

        if (resultMessage.usage) {
          const turnUsage = normalizeUsage(resultMessage.usage);
          usage.promptTokens += turnUsage.promptTokens;
          usage.completionTokens += turnUsage.completionTokens;
          usage.totalTokens += turnUsage.totalTokens;
        }

        if (resultMessage.subtype === 'success') {
          const output = typeof resultMessage.result === 'string' && resultMessage.result.trim().length
            ? resultMessage.result
            : fragments.join('');

          claudeDebugLog('Agent refinement raw output', output);

          const parsed = parseRefinementOutput(output);
          const warnings: string[] = [];

          if (!parsed || parsed.length === 0) {
            warnings.push('Agent did not return parseable section data.');
            throw new Error(warnings.join(' '));
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
          console.log(`[Claude Agent] ✓ Refinement complete: ${sections.length} sections extracted`);
          // eslint-disable-next-line no-console
          console.log(`[Claude Agent] Tools used: ${Array.from(toolsUsed).join(', ') || 'none'}`);
          // eslint-disable-next-line no-console
          console.log(`[Claude Agent] Turns completed: ${turnsCompleted}`);
          // eslint-disable-next-line no-console
          console.log(`[Claude Agent] Token usage: ${usage.totalTokens} total (${usage.promptTokens} prompt + ${usage.completionTokens} completion)`);

          return {
            sections,
            warnings: warnings.length > 0 ? warnings : undefined,
            claudeUsed: true,
            usage
          };
        }

        if (resultMessage.subtype === 'error') {
          const reason = resultMessage.error?.message ?? 'Agent returned an error result.';
          throw new Error(reason);
        }

        if (resultMessage.subtype === 'interrupted') {
          throw new Error('Agent run was interrupted before completion.');
        }
      }
    }

    // If we get here without a result, return empty
    throw new Error('Agent completed without returning section data.');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Agent refinement failed:', error);
    throw error instanceof Error ? error : new Error('Agent refinement failed with unknown error.');
  }
}

/**
 * Simple prompt for when Skills are enabled - delegates detailed workflow to the Skill
 */
function buildSimpleRefinementPrompt(templatePath: string): string {
  return `Analyze regulatory template to extract section headings with summaries.

**Template:** ${templatePath}

**Critical:** Use your **regulatory-document-parser** skill and follow its search-first workflow.

**Required Process:**
1. Parse template to markdown using semtools parse command
2. Use SEMANTIC SEARCH (search command) for section discovery:
   - Start broad: "table of contents sections modules"
   - Refine: "module 2 clinical nonclinical quality"
   - Target: specific section types as needed
3. Use grep for EXACT pattern extraction (after search identifies areas)
4. Combine semantic findings + exact patterns into complete section list

**Output Format:**
{
  "sections": [
    {"title": "...", "summary": "...", "originalHeading": "..."}
  ]
}

**Requirements:**
- Return ONLY the JSON object (no markdown fences, no explanatory text)
- If extraction fails, return {"sections": []}
- Follow the skill's search → grep pattern

Invoke your regulatory-document-parser skill now.`;
}

/**
 * Detailed prompt for when Skills are disabled - includes full workflow instructions
 */
function buildAgentRefinementPrompt(templatePath: string): string {
  return `You are analyzing a regulatory document template to extract its complete section structure.

Template File: ${templatePath}

TASK: Extract ALL section headings from this PDF/DOCX template and return structured JSON with summaries.

STEP 1 - Parse the Document:
Use the 'parse' command from semtools to convert the PDF to clean markdown:
  parse ${templatePath}

This will give you the parsed markdown file path (usually in ~/.parse/). Read that file to see the full document structure.

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
- Use semtools to parse the PDF first
- Extract ALL sections (don't truncate or limit)
- Return ONLY the JSON object
- Start output with { and end with }
- NO markdown code fences
- If you cannot parse the file, return {"sections": []}

Begin by using the 'parse' command to read the template.`;
}

/**
 * Create folder structure for a program based on refined sections
 * Uses the agent to analyze sections and create appropriate folder hierarchy with a single Bash call
 */
export async function createProgramStructure(params: StructureCreationParams): Promise<StructureCreationResult> {
  if (!isClaudeAvailable()) {
    throw new Error('Claude Agent not available. Check configuration.');
  }

  const prompt = buildStructureCreationPrompt(params);

  try {
    claudeDebugLog('Structure creation prompt', prompt.slice(0, 2000));

    // eslint-disable-next-line no-console
    console.log('[Claude Agent] Creating program folder structure...');
    // eslint-disable-next-line no-console
    console.log('[Claude Agent] Program path:', params.programPath);
    // eslint-disable-next-line no-console
    console.log('[Claude Agent] Sections to create:', params.sections.length);

    const agentQuery = query({
      prompt,
      options: {
        maxTurns: 6,
        allowedTools: ['Bash'],
        settingSources: ['project'],
        cwd: params.programPath,
        additionalDirectories: [params.programPath],
        permissionMode: 'bypassPermissions'
      }
    });

    const fragments: string[] = [];
    let usage: ClaudeUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const toolsUsed = new Set<string>();
    let turnsCompleted = 0;

    // eslint-disable-next-line no-restricted-syntax
    for await (const message of agentQuery as AsyncIterable<Record<string, unknown>>) {
      const messageType = typeof message?.type === 'string' ? (message.type as string) : 'unknown';
      claudeDebugLog('Structure creation message type', messageType);

      if (messageType === 'assistant') {
        turnsCompleted += 1;
        const assistantMessage = message as {
          message?: {
            content?: Array<{ type?: string; text?: string; name?: string; input?: unknown }>;
          };
        };
        const assistantContent = assistantMessage.message?.content;

        if (Array.isArray(assistantContent)) {
          for (const block of assistantContent) {
            if (block?.type === 'text' && typeof block.text === 'string') {
              fragments.push(block.text);
            }
            if (block?.type === 'tool_use' && typeof block.name === 'string') {
              toolsUsed.add(block.name);
              claudeDebugLog(`Structure creation tool: ${block.name}`, block.input);
            }
          }
        }
      }

      if (messageType === 'result') {
        const resultMessage = message as {
          subtype?: string;
          result?: string;
          usage?: ClaudeUsagePayload;
          error?: { message?: string };
        };

        if (resultMessage.usage) {
          const turnUsage = normalizeUsage(resultMessage.usage);
          usage.promptTokens += turnUsage.promptTokens;
          usage.completionTokens += turnUsage.completionTokens;
          usage.totalTokens += turnUsage.totalTokens;
        }

        if (resultMessage.subtype === 'success') {
          const output = typeof resultMessage.result === 'string' && resultMessage.result.trim().length
            ? resultMessage.result
            : fragments.join('');

          claudeDebugLog('Structure creation output', output);

          // Parse the JSON output to get created files
          const parsed = parseStructureOutput(output);

          // eslint-disable-next-line no-console
          console.log(`[Claude Agent] ✓ Structure creation complete`);
          // eslint-disable-next-line no-console
          console.log(`[Claude Agent] Files created: ${parsed.filesCreated.length}`);
          // eslint-disable-next-line no-console
          console.log(`[Claude Agent] Tools used: ${Array.from(toolsUsed).join(', ') || 'none'}`);
          // eslint-disable-next-line no-console
          console.log(`[Claude Agent] Turns completed: ${turnsCompleted}`);

          return {
            success: true,
            filesCreated: parsed.filesCreated,
            sectionRoot: parsed.sectionRoot,
            warnings: parsed.warnings,
            usage
          };
        }

        if (resultMessage.subtype === 'error') {
          const reason = resultMessage.error?.message ?? 'Agent returned an error result.';
          throw new Error(reason);
        }

        if (resultMessage.subtype === 'interrupted') {
          throw new Error('Agent run was interrupted before completion.');
        }
      }
    }

    // Fallback if no result received
    throw new Error('Agent completed without returning structure data.');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Structure creation failed:', error);
    throw error instanceof Error ? error : new Error('Structure creation failed with unknown error.');
  }
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
   - Example: "10.1.4 Recruitment" => "10-Supporting-Documentation-Operational-Considerations/10-1-Appendix-1-.../10-1-4-Recruitment/content.md"
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

6. Use a SINGLE Bash tool call to create ALL directories and files.
   - Build one multi-line bash script that runs all mkdir -p and file writes.
   - Use cat <<'EOF' > "path/to/content.md" to write each file.
   - Do NOT make multiple tool calls. Do NOT use the Write tool.
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
- Use exactly one Bash tool call for all file creation
- Output ONLY the final JSON summary after creating all files
- Start JSON with { and end with }`;
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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to parse structure output:', error);
    return {
      filesCreated: [],
      warnings: ['Failed to parse structure creation output']
    };
  }
}
