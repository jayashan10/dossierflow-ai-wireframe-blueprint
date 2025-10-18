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

vi.mock('../src/services/text-extraction', () => ({
  extractTextFromDocx: extractionMocks.docxMock,
  extractTextFromPdf: extractionMocks.pdfMock
}));

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
    expect(response.body.template.sections).toEqual(['1. Executive Summary', '2. Introduction']);
    expect(response.body.template.warnings).toContain('Test warning');
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

