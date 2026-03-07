/**
 * Agent Provider Abstraction Layer
 *
 * Routes all AI agent calls to the active provider (Claude or Codex) based on
 * the AI_PROVIDER configuration. This module re-exports the shared types and
 * provides factory functions that delegate to the correct implementation.
 *
 * Usage in routes:
 *   import { generateDraft, generateDraftStream, ... } from '../services/agent-provider';
 *
 * The active provider is determined by appConfig.aiProvider ('claude' | 'codex').
 */

import { appConfig } from '../config';

// Re-export all shared types from the Claude service (canonical type definitions)
export type {
  TemplateRefinedSection,
  SectionRefinementResult,
  StreamGenerateParams,
  StructureCreationParams,
  StructureCreationResult,
  StreamEvent,
  InlineRefineParams
} from './claude-agent-service';

// Import both provider implementations
import * as claude from './claude-agent-service';
import * as codex from './codex-agent-service';

// ---------------------------------------------------------------------------
// Provider type
// ---------------------------------------------------------------------------

export type AIProvider = 'claude' | 'codex';

/**
 * Get the currently active AI provider name
 */
export function getActiveProvider(): AIProvider {
  return appConfig.aiProvider;
}

/**
 * Check if the active provider is available and configured
 */
export function isActiveProviderAvailable(): boolean {
  const provider = getActiveProvider();
  if (provider === 'codex') {
    return codex.isCodexAvailable();
  }
  return appConfig.enableClaudeAgent;
}

// ---------------------------------------------------------------------------
// Delegating functions — route to active provider
// ---------------------------------------------------------------------------

/**
 * Generate section draft content (non-streaming)
 */
export async function generateDraft(params: Parameters<typeof claude.generateDraft>[0]): ReturnType<typeof claude.generateDraft> {
  const provider = getActiveProvider();
  if (provider === 'codex') {
    return codex.generateDraft(params);
  }
  return claude.generateDraft(params);
}

/**
 * Streaming content generation
 */
export async function* generateDraftStream(
  params: Parameters<typeof claude.generateDraftStream>[0]
): AsyncGenerator<claude.StreamEvent> {
  const provider = getActiveProvider();
  if (provider === 'codex') {
    yield* codex.generateDraftStream(params);
  } else {
    yield* claude.generateDraftStream(params);
  }
}

/**
 * Inline text refinement (streaming)
 */
export async function* refineInlineStream(
  params: Parameters<typeof claude.refineInlineStream>[0]
): AsyncGenerator<claude.StreamEvent> {
  const provider = getActiveProvider();
  if (provider === 'codex') {
    yield* codex.refineInlineStream(params);
  } else {
    yield* claude.refineInlineStream(params);
  }
}

/**
 * Refine extracted template sections (headings → structured JSON)
 */
export async function refineExtractedSections(
  headings: string[]
): ReturnType<typeof claude.refineExtractedSections> {
  const provider = getActiveProvider();
  if (provider === 'codex') {
    return codex.refineExtractedSections(headings);
  }
  return claude.refineExtractedSections(headings);
}

/**
 * Refine template sections from file (agentic with semtools)
 */
export async function refineTemplateSections(
  templatePath: string
): ReturnType<typeof claude.refineTemplateSections> {
  const provider = getActiveProvider();
  if (provider === 'codex') {
    return codex.refineTemplateSections(templatePath);
  }
  return claude.refineTemplateSections(templatePath);
}

/**
 * Create program folder structure from sections
 */
export async function createProgramStructure(
  params: Parameters<typeof claude.createProgramStructure>[0]
): ReturnType<typeof claude.createProgramStructure> {
  const provider = getActiveProvider();
  if (provider === 'codex') {
    return codex.createProgramStructure(params);
  }
  return claude.createProgramStructure(params);
}

/**
 * Log authentication status for the active provider at startup
 */
export function logProviderAuthStatus(): void {
  const provider = getActiveProvider();
  // eslint-disable-next-line no-console
  console.log(`  Active AI Provider: ${provider.toUpperCase()}`);

  // Always log Claude status since it's the default
  claude.logClaudeAuthStatus();

  // Log Codex status if enabled
  codex.logCodexAuthStatus();
}
