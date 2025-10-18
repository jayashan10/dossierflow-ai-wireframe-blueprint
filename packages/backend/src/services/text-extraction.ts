import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

export interface ExtractionResult {
  text: string;
  warnings?: string[];
}

const DEFAULT_WARNING = 'File text extraction returned empty content.';

export async function extractTextFromPdf(buffer: Buffer): Promise<ExtractionResult> {
  const warnings: string[] = [];

  try {
    const result = await pdfParse(buffer);
    const text = normalizeExtractedText(result.text ?? '');

    if (!text) {
      warnings.push(DEFAULT_WARNING);
    }

    return { text, warnings: warnings.length ? warnings : undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to extract text from PDF: ${message}`);
  }
}

export async function extractTextFromDocx(buffer: Buffer): Promise<ExtractionResult> {
  const warnings: string[] = [];

  try {
    const arrayBuffer = toArrayBuffer(buffer);
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const html = result.value ?? '';
    const textFromHtml = stripHtml(html);

    if (result.messages?.length) {
      for (const message of result.messages) {
        warnings.push(message.message || 'DOCX conversion message.');
      }
    }

    const text = normalizeExtractedText(textFromHtml);

    if (!text) {
      warnings.push(DEFAULT_WARNING);
    }

    return { text, warnings: warnings.length ? normalizeWarnings(warnings) : undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to extract text from DOCX: ${message}`);
  }
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  for (let index = 0; index < buffer.length; index += 1) {
    uint8Array[index] = buffer[index];
  }
  return arrayBuffer;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\t\f\v]+/g, ' ')
    .replace(/\u0000/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeWarnings(warnings: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const warning of warnings) {
    const trimmed = warning.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

