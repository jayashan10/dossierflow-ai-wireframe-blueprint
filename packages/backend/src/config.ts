import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CODEX_API_KEY: z.string().trim().optional().transform((value) => value || undefined),
  SOURCE_ROOT: z.string().trim().optional(),
  TEMPLATE_ROOT: z.string().trim().optional()
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
  codexApiKey: parsed.CODEX_API_KEY,
  sourceRoot: parsed.SOURCE_ROOT ? path.resolve(parsed.SOURCE_ROOT) : defaultSourceRoot,
  templateRoot: parsed.TEMPLATE_ROOT ? path.resolve(parsed.TEMPLATE_ROOT) : defaultTemplateRoot
};

ensureDirectoryExists(appConfig.sourceRoot);
ensureDirectoryExists(appConfig.templateRoot);

export type AppConfig = typeof appConfig;
