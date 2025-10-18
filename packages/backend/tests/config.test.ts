import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('configuration defaults', () => {
  it('provides expected defaults when env is unset', async () => {
    const { appConfig } = await import('../src/config');

    expect(appConfig.port).toBe(4000);
    expect(appConfig.sourceRoot).toBeDefined();
    expect(fs.existsSync(appConfig.sourceRoot)).toBe(true);
    expect(appConfig.templateRoot).toBeDefined();
    expect(fs.existsSync(appConfig.templateRoot)).toBe(true);
  });
});
