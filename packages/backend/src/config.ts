import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
      return false;
    }
  }

  return undefined;
}

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  // Anthropic Claude Agent SDK authentication
  ANTHROPIC_API_KEY: z.string().trim().optional().transform((value) => value || undefined),
  ANTHROPIC_BASE_URL: z.string().trim().optional().transform((value) => value || undefined),
  ANTHROPIC_AUTH_TOKEN: z.string().trim().optional().transform((value) => value || undefined),
  ANTHROPIC_CUSTOM_HEADERS: z.string().optional().transform((value) => (value && value.trim().length ? value : undefined)),
  CLAUDE_CODE_USE_BEDROCK: z
    .union([z.string(), z.number(), z.boolean()])
    .optional()
    .transform((value) => toOptionalBoolean(value)),
  CLAUDE_CODE_USE_VERTEX: z
    .union([z.string(), z.number(), z.boolean()])
    .optional()
    .transform((value) => toOptionalBoolean(value)),
  SOURCE_ROOT: z.string().trim().optional(),
  TEMPLATE_ROOT: z.string().trim().optional(),
  // Feature flags for Claude Agent SDK integration
  ENABLE_CLAUDE_AGENT: z.coerce.boolean().default(true),
  USE_SEMTOOLS: z.coerce.boolean().default(false),
  // Semtools configuration
  LLAMA_CLOUD_API_KEY: z.string().trim().optional().transform((value) => value || undefined),
  SEMTOOLS_WORKSPACE: z.string().trim().default('dossierflow'),
  // Agent configuration
  AGENT_MAX_TURNS: z.coerce.number().int().min(1).max(50).default(5),
  AGENT_ENABLE_TOOLS: z.coerce.boolean().default(true)
});

const parsed = envSchema.parse(process.env);

const defaultSourceRoot = path.resolve(process.cwd(), '..', 'data');
const defaultTemplateRoot = path.resolve(process.cwd(), '..', 'templates');

function ensureDirectoryExists(absolutePath: string) {
  if (!fs.existsSync(absolutePath)) {
    fs.mkdirSync(absolutePath, { recursive: true });
  }
}

export const appConfig = {
  port: parsed.PORT,
  anthropicApiKey: parsed.ANTHROPIC_API_KEY,
  anthropicBaseUrl: parsed.ANTHROPIC_BASE_URL,
  anthropicAuthToken: parsed.ANTHROPIC_AUTH_TOKEN,
  anthropicCustomHeaders: parsed.ANTHROPIC_CUSTOM_HEADERS,
  claudeUseBedrock: parsed.CLAUDE_CODE_USE_BEDROCK,
  claudeUseVertex: parsed.CLAUDE_CODE_USE_VERTEX,
  sourceRoot: parsed.SOURCE_ROOT ? path.resolve(parsed.SOURCE_ROOT) : defaultSourceRoot,
  templateRoot: parsed.TEMPLATE_ROOT ? path.resolve(parsed.TEMPLATE_ROOT) : defaultTemplateRoot,
  enableClaudeAgent: parsed.ENABLE_CLAUDE_AGENT,
  useSemtools: parsed.USE_SEMTOOLS,
  llamaCloudApiKey: parsed.LLAMA_CLOUD_API_KEY,
  semtoolsWorkspace: parsed.SEMTOOLS_WORKSPACE,
  agentMaxTurns: parsed.AGENT_MAX_TURNS,
  agentEnableTools: parsed.AGENT_ENABLE_TOOLS
};

ensureDirectoryExists(appConfig.sourceRoot);
ensureDirectoryExists(appConfig.templateRoot);

export type AppConfig = typeof appConfig;
