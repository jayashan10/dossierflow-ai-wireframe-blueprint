import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from '../src/server';

const serviceMocks = vi.hoisted(() => {
  const buildSnippet = () => ({
    id: 'src-mock-1',
    name: 'Mock Source',
    type: 'docx',
    relativePath: 'mock/path',
    createdAt: new Date().toISOString(),
    warnings: ['Mock extraction warning']
  });

  let snippet = buildSnippet();

  const fetchSourceSnippets = vi.fn().mockImplementation(async () => [snippet]);

  const generateDraft = vi
    .fn()
    .mockImplementation(async ({ snippets }) => ({
      content: 'Generated content',
      metadata: {
        codexUsed: false,
        snippetCount: snippets.length
      },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    }));

  const reset = () => {
    snippet = buildSnippet();
    fetchSourceSnippets.mockReset();
    fetchSourceSnippets.mockImplementation(async () => [snippet]);
    generateDraft.mockReset();
    generateDraft.mockImplementation(async ({ snippets }) => ({
      content: 'Generated content',
      metadata: {
        codexUsed: false,
        snippetCount: snippets.length
      },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    }));
  };

  return {
    fetchSourceSnippets,
    generateDraft,
    reset,
    get snippet() {
      return snippet;
    }
  };
});

vi.mock('../src/services/source-service', () => ({
  fetchSourceSnippets: serviceMocks.fetchSourceSnippets
}));

vi.mock('../src/services/text-extraction', () => ({
  extractTextFromDocx: vi.fn(),
  extractTextFromPdf: vi.fn()
}));

vi.mock('../src/services/codex-service', () => ({
  generateDraft: serviceMocks.generateDraft
}));

describe('POST /api/generate', () => {
  const app = createServer();

  beforeEach(() => {
    serviceMocks.reset();
  });

  it('returns mocked content for valid payload', async () => {
    const response = await request(app)
      .post('/api/generate')
      .send({
        sectionId: 'sec-1',
        sectionTitle: 'Test Section',
        prompt: 'Generate a summary based on sample data.',
        selectedSourceIds: ['src-mock-1']
      });

    expect(response.status).toBe(200);
    expect(serviceMocks.fetchSourceSnippets).toHaveBeenCalledWith(['src-mock-1']);
    expect(serviceMocks.generateDraft).toHaveBeenCalled();
    expect(response.body.metadata.sectionId).toBe('sec-1');
    expect(response.body.metadata.sources).toEqual([
      expect.objectContaining({
        id: 'src-mock-1',
        name: expect.any(String),
        warnings: expect.arrayContaining(['Mock extraction warning'])
      })
    ]);
    expect(response.body.metadata.codexUsed).toBe(false);
    expect(typeof response.body.content).toBe('string');
  });

  it('rejects invalid payloads', async () => {
    const response = await request(app).post('/api/generate').send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });
});
