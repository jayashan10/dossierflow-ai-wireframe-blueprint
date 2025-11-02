import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appConfig } from '../src/config';
import { createServer } from '../src/server';

const fixturesDir = path.resolve(__dirname, '__fixtures__');

const serviceMocks = vi.hoisted(() => {
  const docxMock = vi.fn().mockResolvedValue({
    text: '1. Executive Summary\n2. Introduction',
    warnings: ['Mock extraction warning']
  });

  const pdfMock = vi.fn().mockResolvedValue({ text: 'PDF placeholder', warnings: undefined });
  const generateDraftMock = vi.fn().mockImplementation(async ({ snippets }) => ({
    content: 'Generated content',
    metadata: {
      agentUsed: false,
      snippetCount: snippets.length,
      toolsUsed: [],
      turnsCompleted: 0
    },
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  }));

  return { docxMock, pdfMock, generateDraftMock };
});

vi.mock('../src/services/text-extraction', () => ({
  extractTextFromDocx: serviceMocks.docxMock,
  extractTextFromPdf: serviceMocks.pdfMock
}));

vi.mock('../src/services/claude-agent-service', () => ({
  generateDraft: serviceMocks.generateDraftMock
}));

describe('Sources API', () => {
  const app = createServer();

  beforeEach(async () => {
    serviceMocks.docxMock.mockReset();
    serviceMocks.pdfMock.mockReset();
    serviceMocks.generateDraftMock.mockReset();

    serviceMocks.docxMock.mockResolvedValue({
      text: '1. Executive Summary\n2. Introduction',
      warnings: ['Mock extraction warning']
    });

    serviceMocks.pdfMock.mockResolvedValue({ text: 'PDF placeholder', warnings: undefined });

    serviceMocks.generateDraftMock.mockImplementation(async ({ snippets }) => ({
      content: 'Generated content',
      metadata: {
        agentUsed: false,
        snippetCount: snippets.length,
        toolsUsed: [],
        turnsCompleted: 0
      },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    }));

    await fs.rm(appConfig.sourceRoot, { recursive: true, force: true });
    await fs.mkdir(appConfig.sourceRoot, { recursive: true });
    await fs.mkdir(fixturesDir, { recursive: true });

    await fs.writeFile(path.join(fixturesDir, 'sample-source.docx'), 'DOCX');
    await fs.writeFile(path.join(fixturesDir, 'sample-source.pdf'), 'PDF');
  });

  it('uploads multiple source files and lists them', async () => {
    const pdfPath = path.join(fixturesDir, 'sample-source.pdf');
    const docxPath = path.join(fixturesDir, 'sample-source.docx');

    const uploadResponse = await request(app)
      .post('/api/sources/upload')
      .attach('files', pdfPath)
      .attach('files', docxPath);

    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body.sources).toHaveLength(2);

    const listResponse = await request(app).get('/api/sources');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.sources.length).toBeGreaterThanOrEqual(2);
  });

  it('returns snippets for uploaded sources on generate', async () => {
    const docxPath = path.join(fixturesDir, 'sample-source.docx');

    const uploadResponse = await request(app)
      .post('/api/sources/upload')
      .attach('files', docxPath);

    const sourceId: string = uploadResponse.body.sources[0].id;

    const generateResponse = await request(app)
      .post('/api/generate')
      .send({
        sectionId: 'sec-123',
        sectionTitle: 'Test Section',
        prompt: 'Draft a short summary.',
        selectedSourceIds: [sourceId]
      });

    expect(generateResponse.status).toBe(200);
    const sourceMetadata = generateResponse.body.metadata.sources[0];
    expect(sourceMetadata).toMatchObject({
      id: sourceId,
      warnings: expect.arrayContaining(['Mock extraction warning'])
    });
  });
});
