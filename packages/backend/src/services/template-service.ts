import fs from 'node:fs/promises';
import path from 'node:path';
import { appConfig } from '../config';
import {
  MAX_FILE_SIZE_BYTES,
  persistUploadedFile,
  type StoredFileInfo,
  type UploadedFile
} from './file-service';
import { extractSectionsFromText } from './section-extractor';
import { extractTextFromDocx, extractTextFromPdf } from './text-extraction';

const TEMPLATE_INDEX_FILENAME = '.templates.json';

interface TemplateRecord {
  id: string;
  name: string;
  originalFileName: string;
  storedFile: StoredFileInfo;
  createdAt: string;
  sections: string[];
  warnings?: string[];
}

interface TemplateIndex {
  templates: TemplateRecord[];
}

export interface TemplateSummary {
  id: string;
  name: string;
  sectionCount: number;
  createdAt: string;
}

export interface TemplateDetails extends TemplateSummary {
  sections: string[];
  warnings?: string[];
  originalFileName: string;
  relativePath: string;
}

function getIndexPath(): string {
  return path.join(appConfig.templateRoot, TEMPLATE_INDEX_FILENAME);
}

async function loadIndex(): Promise<TemplateIndex> {
  try {
    const raw = await fs.readFile(getIndexPath(), 'utf8');
    const parsed = JSON.parse(raw) as TemplateIndex;
    if (!parsed.templates) {
      return { templates: [] };
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { templates: [] };
    }
    throw error;
  }
}

async function saveIndex(index: TemplateIndex): Promise<void> {
  const serialized = JSON.stringify(index, null, 2);
  await fs.writeFile(getIndexPath(), serialized, 'utf8');
}

async function extractTextFromFile(storedFile: StoredFileInfo): Promise<{ text: string; warnings?: string[] }> {
  const buffer = await fs.readFile(storedFile.absolutePath);

  if (storedFile.extension === '.pdf') {
    return extractTextFromPdf(buffer);
  }

  if (storedFile.extension === '.docx') {
    return extractTextFromDocx(buffer);
  }

  throw new Error(`Unsupported template extension: ${storedFile.extension}`);
}

export async function saveTemplate(upload: UploadedFile): Promise<TemplateDetails> {
  if (upload.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('Template exceeds maximum allowed size (10 MB).');
  }

  const storedFile = await persistUploadedFile({
    rootDirectory: appConfig.templateRoot,
    prefix: 'template',
    upload
  });

  const extraction = await extractTextFromFile(storedFile);
  const { sections, warnings: sectionWarnings } = extractSectionsFromText(extraction.text);

  const recordWarnings = combineWarnings(extraction.warnings, sectionWarnings);
  const record: TemplateRecord = {
    id: storedFile.id,
    name: storedFile.originalName,
    originalFileName: storedFile.originalName,
    storedFile,
    createdAt: new Date().toISOString(),
    sections,
    warnings: recordWarnings
  };

  const index = await loadIndex();
  index.templates.unshift(record);
  await saveIndex(index);

  return toTemplateDetails(record);
}

export async function listTemplates(): Promise<TemplateSummary[]> {
  const index = await loadIndex();
  return index.templates.map((record) => ({
    id: record.id,
    name: record.name,
    sectionCount: record.sections.length,
    createdAt: record.createdAt
  }));
}

export async function getTemplate(templateId: string): Promise<TemplateDetails | null> {
  const index = await loadIndex();
  const record = index.templates.find((item) => item.id === templateId);
  return record ? toTemplateDetails(record) : null;
}

function toTemplateDetails(record: TemplateRecord): TemplateDetails {
  return {
    id: record.id,
    name: record.name,
    sectionCount: record.sections.length,
    createdAt: record.createdAt,
    sections: record.sections,
    warnings: record.warnings,
    originalFileName: record.originalFileName,
    relativePath: record.storedFile.relativePath
  };
}

function combineWarnings(
  ...warningGroups: Array<string[] | undefined>
): string[] | undefined {
  const combined = warningGroups.flatMap((group) => group ?? []);
  if (!combined.length) {
    return undefined;
  }

  const unique = new Set<string>();
  const normalized: string[] = [];

  for (const warning of combined) {
    const trimmed = warning.trim();
    if (!trimmed || unique.has(trimmed)) continue;
    unique.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

