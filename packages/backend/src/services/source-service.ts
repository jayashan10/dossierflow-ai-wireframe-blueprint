import fs from 'node:fs/promises';
import path from 'node:path';
import { appConfig } from '../config';
import {
  persistUploadedFile,
  type UploadedFile,
  type StoredFileInfo
} from './file-service';
import { extractTextFromDocx, extractTextFromPdf } from './text-extraction';

const SOURCE_INDEX_FILENAME = '.sources.json';
const MAX_SOURCES_TRACKED = 2000;

export interface SourceSummary {
  id: string;
  name: string;
  type: string;
  mimeType?: string;
  relativePath: string;
  createdAt: string;
  tags: string[];
}

export interface SourceSnippet extends SourceSummary {
  content?: string;
  warnings?: string[];
  absolutePath: string;
}

export interface SourceFileDescriptor {
  id: string;
  name: string;
  type: string;
  relativePath: string;
  absolutePath: string;
  createdAt: string;
  tags?: string[];
}

interface SourceRecord extends SourceSummary {
  storedFile: StoredFileInfo;
}

interface SourceIndex {
  sources: SourceRecord[];
}

export interface SaveSourceResult {
  sources: SourceSummary[];
  warnings?: string[];
}

export interface SourceFileRef {
  id: string;
  name: string;
  absolutePath: string;
  relativePath: string;
}

function getIndexPath(): string {
  return path.join(appConfig.sourceRoot, SOURCE_INDEX_FILENAME);
}

async function loadIndex(): Promise<SourceIndex> {
  try {
    const raw = await fs.readFile(getIndexPath(), 'utf8');
    const parsed = JSON.parse(raw) as SourceIndex;
    if (!parsed.sources) {
      return { sources: [] };
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { sources: [] };
    }
    throw error;
  }
}

async function saveIndex(index: SourceIndex): Promise<void> {
  const serialized = JSON.stringify(index, null, 2);
  await fs.writeFile(getIndexPath(), serialized, 'utf8');
}

export async function saveSources(uploads: UploadedFile[]): Promise<SaveSourceResult> {
  if (!uploads.length) {
    return { sources: [], warnings: ['No files were provided.'] };
  }

  const index = await loadIndex();
  const newSources: SourceRecord[] = [];
  const warnings: string[] = [];

  for (const upload of uploads) {
    try {
      const storedFile = await persistUploadedFile({
        rootDirectory: appConfig.sourceRoot,
        prefix: 'source',
        upload
      });

      const record: SourceRecord = {
        id: storedFile.id,
        name: storedFile.originalName,
        type: storedFile.extension.replace('.', ''),
        mimeType: storedFile.mimeType,
        relativePath: storedFile.relativePath,
        createdAt: new Date().toISOString(),
        tags: [],
        storedFile
      };

      index.sources.unshift(record);
      newSources.push(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      warnings.push(`${upload.originalName}: ${message}`);
    }
  }

  if (index.sources.length > MAX_SOURCES_TRACKED) {
    index.sources = index.sources.slice(0, MAX_SOURCES_TRACKED);
  }

  await saveIndex(index);

  return {
    sources: newSources.map(toSourceSummary),
    warnings: warnings.length ? warnings : undefined
  };
}

export async function registerExternalSource(storedFile: StoredFileInfo): Promise<SourceSummary> {
  const index = await loadIndex();
  const existing = index.sources.find((source) => source.storedFile?.absolutePath === storedFile.absolutePath);
  if (existing) {
    return toSourceSummary(existing);
  }
  const record: SourceRecord = {
    id: storedFile.id,
    name: storedFile.originalName,
    type: storedFile.extension.replace('.', ''),
    mimeType: storedFile.mimeType,
    relativePath: storedFile.relativePath,
    createdAt: new Date().toISOString(),
    tags: [],
    storedFile
  };

  index.sources.unshift(record);
  if (index.sources.length > MAX_SOURCES_TRACKED) {
    index.sources = index.sources.slice(0, MAX_SOURCES_TRACKED);
  }

  await saveIndex(index);
  return toSourceSummary(record);
}

export async function listSources(search?: string): Promise<SourceSummary[]> {
  const index = await loadIndex();
  const normalizedSearch = search?.trim().toLowerCase();
  const seenPaths = new Set<string>();
  const seenNames = new Set<string>();
  const summaries: SourceSummary[] = [];

  for (const record of index.sources) {
    const absolutePath = record.storedFile?.absolutePath;
    const normalizedName = record.name.toLowerCase();
    if (absolutePath && seenPaths.has(absolutePath)) {
      continue;
    }
    if (seenNames.has(normalizedName)) {
      continue;
    }
    if (absolutePath) {
      seenPaths.add(absolutePath);
    }
    seenNames.add(normalizedName);
    summaries.push(toSourceSummary(record));
  }

  if (!normalizedSearch) {
    return summaries;
  }

  return summaries.filter((source) => source.name.toLowerCase().includes(normalizedSearch));
}

export async function fetchSourceSnippets(ids: string[]): Promise<SourceSnippet[]> {
  if (!ids.length) {
    return [];
  }

  const index = await loadIndex();
  const byId = new Map(index.sources.map((source) => [source.id, source] as const));
  const seen = new Set<string>();
  const snippets: SourceSnippet[] = [];

  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);

    const record = byId.get(id);
    if (!record) {
      continue;
    }

    try {
      const extraction = await extractSourceText(record.storedFile);
      const content = extraction.text.slice(0, 4000);
      const warnings = combineWarnings(extraction.warnings, content.length < extraction.text.length ? ['Content truncated to 4000 characters.'] : undefined);

      snippets.push({
        ...toSourceSummary(record),
        content,
        warnings,
        absolutePath: record.storedFile.absolutePath
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      snippets.push({
        ...toSourceSummary(record),
        warnings: [`Content unavailable: ${message}`],
        absolutePath: record.storedFile.absolutePath
      });
    }
  }

  return snippets;
}

export async function getSourceById(id: string): Promise<SourceSummary | null> {
  const index = await loadIndex();
  const record = index.sources.find((source) => source.id === id);
  return record ? toSourceSummary(record) : null;
}

export async function updateSourceTags(
  id: string,
  tags: string[]
): Promise<SourceSummary | null> {
  const index = await loadIndex();
  const recordIndex = index.sources.findIndex((source) => source.id === id);

  if (recordIndex === -1) {
    return null;
  }

  // Normalize and deduplicate tags
  const normalizedTags = [...new Set(
    tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)
  )];

  index.sources[recordIndex] = {
    ...index.sources[recordIndex],
    tags: normalizedTags
  };

  await saveIndex(index);
  return toSourceSummary(index.sources[recordIndex]);
}

export async function getSourceFilePaths(ids: string[]): Promise<SourceFileRef[]> {
  if (!ids.length) {
    return [];
  }

  const index = await loadIndex();
  const byId = new Map(index.sources.map((source) => [source.id, source] as const));
  const seen = new Set<string>();
  const refs: SourceFileRef[] = [];

  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);

    const record = byId.get(id);
    if (!record) {
      continue;
    }

    refs.push({
      id: record.id,
      name: record.name,
      absolutePath: record.storedFile.absolutePath,
      relativePath: record.relativePath
    });
  }

  return refs;
}

export async function fetchSourceSnippetsFromDescriptors(files: SourceFileDescriptor[]): Promise<SourceSnippet[]> {
  if (!files.length) {
    return [];
  }

  const snippets: SourceSnippet[] = [];

  for (const file of files) {
    try {
      const extraction = await extractSourceTextFromPath(file.absolutePath);
      const content = extraction.text.slice(0, 4000);
      const warnings = combineWarnings(
        extraction.warnings,
        content.length < extraction.text.length ? ['Content truncated to 4000 characters.'] : undefined
      );

      snippets.push({
        id: file.id,
        name: file.name,
        type: file.type,
        relativePath: file.relativePath,
        createdAt: file.createdAt,
        tags: file.tags ?? [],
        content,
        warnings,
        absolutePath: file.absolutePath
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      snippets.push({
        id: file.id,
        name: file.name,
        type: file.type,
        relativePath: file.relativePath,
        createdAt: file.createdAt,
        tags: file.tags ?? [],
        warnings: [`Content unavailable: ${message}`],
        absolutePath: file.absolutePath
      });
    }
  }

  return snippets;
}

async function extractSourceText(storedFile: StoredFileInfo): Promise<{ text: string; warnings?: string[] }> {
  const buffer = await fs.readFile(storedFile.absolutePath);

  if (storedFile.extension === '.pdf') {
    return extractTextFromPdf(buffer);
  }

  if (storedFile.extension === '.docx') {
    return extractTextFromDocx(buffer);
  }

  throw new Error(`Unsupported source extension: ${storedFile.extension}`);
}

async function extractSourceTextFromPath(absolutePath: string): Promise<{ text: string; warnings?: string[] }> {
  const buffer = await fs.readFile(absolutePath);
  const extension = path.extname(absolutePath).toLowerCase();

  if (extension === '.pdf') {
    return extractTextFromPdf(buffer);
  }

  if (extension === '.docx') {
    return extractTextFromDocx(buffer);
  }

  throw new Error(`Unsupported source extension: ${extension}`);
}

function toSourceSummary(record: SourceRecord): SourceSummary {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    mimeType: record.mimeType,
    relativePath: record.relativePath,
    createdAt: record.createdAt,
    tags: record.tags || []
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
