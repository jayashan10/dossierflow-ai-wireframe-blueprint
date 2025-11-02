import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appConfig } from '../src/config';
import { createServer } from '../src/server';

const fixturesDir = path.resolve(__dirname, '__fixtures__');

const extractionMocks = vi.hoisted(() => {
  const docxMock = vi.fn().mockResolvedValue({
    text: '1. Executive Summary\n2. Introduction',
    warnings: ['Test warning']
  });

  const pdfMock = vi.fn().mockResolvedValue({ text: 'PDF placeholder', warnings: undefined });

  return { docxMock, pdfMock };
});

const refinementMock = vi.hoisted(() => vi.fn().mockResolvedValue({
  sections: [
    { title: '1. Executive Summary', summary: 'Summary details', originalHeading: '1. Executive Summary' },
    { title: '2. Introduction', summary: 'Summary details', originalHeading: '2. Introduction' }
  ],
  warnings: undefined,
  claudeUsed: false,
  usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
}));

vi.mock('../src/services/text-extraction', () => ({
  extractTextFromDocx: extractionMocks.docxMock,
  extractTextFromPdf: extractionMocks.pdfMock
}));

vi.mock('../src/services/claude-agent-service', async () => {
  const actual = await vi.importActual<typeof import('../src/services/claude-agent-service')>('../src/services/claude-agent-service');
  return {
    ...actual,
    refineExtractedSections: refinementMock,
    refineTemplateSections: refinementMock
  };
});

describe('Templates API', () => {
  const app = createServer();

  beforeEach(async () => {
    extractionMocks.docxMock.mockReset();
    extractionMocks.pdfMock.mockReset();

    extractionMocks.docxMock.mockResolvedValue({
      text: '1. Executive Summary\n2. Introduction',
      warnings: ['Test warning']
    });

    extractionMocks.pdfMock.mockResolvedValue({ text: 'PDF placeholder', warnings: undefined });

    refinementMock.mockClear();
    refinementMock.mockResolvedValue({
      sections: [
        { title: '1. Executive Summary', summary: 'Summary details', originalHeading: '1. Executive Summary' },
        { title: '2. Introduction', summary: 'Summary details', originalHeading: '2. Introduction' }
      ],
      warnings: undefined,
      claudeUsed: true,
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
    });

    await fs.rm(appConfig.templateRoot, { recursive: true, force: true });
    await fs.mkdir(appConfig.templateRoot, { recursive: true });
    await fs.mkdir(fixturesDir, { recursive: true });

    await fs.writeFile(path.join(fixturesDir, 'sample-template.docx'), 'DOCX content');
    await fs.writeFile(path.join(fixturesDir, 'sample.txt'), 'Plain text file');
  });

  it('uploads a DOCX template and returns sections', async () => {
    const docxPath = path.join(fixturesDir, 'sample-template.docx');

    const response = await request(app)
      .post('/api/templates/upload')
      .attach('file', docxPath);

    expect(response.status).toBe(201);
    expect(response.body.template).toBeDefined();
    expect(refinementMock).toHaveBeenCalled();
    expect(response.body.template.refinedSections).toEqual([
      expect.objectContaining({ title: '1. Executive Summary', originalHeading: '1. Executive Summary' }),
      expect.objectContaining({ title: '2. Introduction', originalHeading: '2. Introduction' })
    ]);
    expect(response.body.template.rawSections).toEqual(['1. Executive Summary', '2. Introduction']);
    expect(response.body.template.warnings).toContain('Test warning');
  });

  it('refines an existing template on demand', async () => {
    const docxPath = path.join(fixturesDir, 'sample-template.docx');

    const uploadResponse = await request(app)
      .post('/api/templates/upload')
      .attach('file', docxPath);

    const templateId = uploadResponse.body.template.id;

    refinementMock.mockResolvedValue({
      sections: [
        { title: 'Executive Summary Refined', summary: 'Summary details', originalHeading: '1. Executive Summary' },
        { title: 'Introduction Refined', summary: 'Summary details', originalHeading: '2. Introduction' }
      ],
      warnings: ['Claude warning'],
      claudeUsed: true,
      usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 }
    });

    const refineResponse = await request(app)
      .post(`/api/templates/${templateId}/refine`);

    expect(refinementMock).toHaveBeenCalled();
    expect(refineResponse.status).toBe(200);
    expect(refineResponse.body.template.refinedSections).toEqual([
      expect.objectContaining({ title: 'Executive Summary Refined', originalHeading: '1. Executive Summary' }),
      expect.objectContaining({ title: 'Introduction Refined', originalHeading: '2. Introduction' })
    ]);
    expect(refineResponse.body.template.warnings).toContain('Test warning');
    expect(refineResponse.body.template.warnings).toContain('Claude warning');
    expect(refineResponse.body.template.claudeUsed).toBe(true);
  });

  it('rejects unsupported file types', async () => {
    const txtPath = path.join(fixturesDir, 'sample.txt');

    const response = await request(app)
      .post('/api/templates/upload')
      .attach('file', txtPath);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
    expect(response.body.message).toContain('Unsupported file extension');
  });
});

