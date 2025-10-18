import { config as loadEnv } from 'dotenv';
import { generateDraft } from '../services/codex-service';

loadEnv();

const TEST_SECTION_TITLE = 'Codex SDK connectivity check';
const TEST_PROMPT = 'Reply with "Codex SDK is operational."';

async function main(): Promise<void> {
  try {
    const result = await generateDraft({
      sectionTitle: TEST_SECTION_TITLE,
      userPrompt: TEST_PROMPT,
      snippets: []
    });

    const { metadata, content, usage } = result;
    const codexUsed =
      typeof metadata.codexUsed === 'boolean'
        ? metadata.codexUsed
        : metadata.codexUsed === 'true';
    const errorDetail =
      typeof metadata.error === 'string' ? metadata.error : undefined;

    const responsePreview = content.trim();
    console.log(`[Codex] Adapter available: ${codexUsed ? 'yes' : 'no'}`);
    if (responsePreview.length > 0) {
      console.log('[Codex] Response preview:', responsePreview.slice(0, 500));
    }

    if (codexUsed) {
      console.log(
        `[Codex] Token usage - prompt: ${usage.promptTokens}, completion: ${usage.completionTokens}, total: ${usage.totalTokens}`
      );
      process.exitCode = 0;
      return;
    }

    if (errorDetail) {
      console.warn('[Codex] Adapter reported error:', errorDetail);
    }
    process.exitCode = 1;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error, null, 2);
    console.error('[Codex] Check failed:', message);
    process.exitCode = 1;
  }
}

void main();
