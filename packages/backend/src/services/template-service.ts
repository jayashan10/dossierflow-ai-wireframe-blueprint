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
import {
  refineExtractedSections,
  refineTemplateSections,
  type TemplateRefinedSection,
  type SectionRefinementResult
} from './agent-provider';

const TEMPLATE_INDEX_FILENAME = '.templates.json';

interface TemplateClaudeMetadata {
  claudeUsed: boolean;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  lastRefinedAt?: string;
  agentUsed?: boolean;
  toolsUsed?: string[];
  turnsCompleted?: number;
}

interface TemplateRecord {
  id: string;
  name: string;
  originalFileName: string;
  storedFile: StoredFileInfo;
  createdAt: string;
  rawSections: string[];
  refinedSections: TemplateRefinedSection[];
  claudeMetadata: TemplateClaudeMetadata;
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
  claudeUsed: boolean;
}

export interface TemplateDetails extends TemplateSummary {
  rawSections: string[];
  refinedSections: TemplateRefinedSection[];
  claudeUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
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
    const parsed = JSON.parse(raw) as Partial<TemplateIndex> | undefined;
    if (!parsed || !Array.isArray(parsed.templates)) {
      return { templates: [] };
    }

    return {
      templates: parsed.templates.map(normalizeTemplateRecord)
    };
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

export async function saveTemplate(upload: UploadedFile, options?: { autoRefine?: boolean }): Promise<TemplateDetails> {
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
  const shouldAutoRefine = options?.autoRefine !== false;
  const refinement = shouldAutoRefine ? await refineExtractedSections(sections) : undefined;

  const timestamp = new Date().toISOString();
  const recordWarnings = combineWarnings(extraction.warnings, sectionWarnings, refinement?.warnings);
  const record: TemplateRecord = {
    id: storedFile.id,
    name: storedFile.originalName,
    originalFileName: storedFile.originalName,
    storedFile,
    createdAt: timestamp,
    rawSections: sections,
    refinedSections: refinement?.sections ?? [],
    claudeMetadata: {
      claudeUsed: Boolean(refinement?.claudeUsed && refinement.sections.length > 0),
      usage: refinement?.usage,
      lastRefinedAt: refinement ? timestamp : undefined
    },
    warnings: recordWarnings
  };

  const index = await loadIndex();
  index.templates.unshift(record);
  await saveIndex(index);

  return toTemplateDetails(record);
}

export async function refineTemplateWithSections(templateId: string, headings: string[]): Promise<SectionRefinementResult> {
  const normalized = headings.map((heading) => heading?.trim()).filter((heading): heading is string => Boolean(heading));

  if (!normalized.length) {
    return {
      sections: [],
      warnings: ['No headings available for Claude refinement.'],
      claudeUsed: false,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  }

  return refineExtractedSections(normalized);
}

export async function listTemplates(): Promise<TemplateSummary[]> {
  const index = await loadIndex();
  return index.templates.map((record) => ({
    id: record.id,
    name: record.name,
    sectionCount: record.refinedSections.length || record.rawSections.length,
    createdAt: record.createdAt,
    claudeUsed: record.claudeMetadata.claudeUsed
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
    sectionCount: record.refinedSections.length || record.rawSections.length,
    createdAt: record.createdAt,
    rawSections: record.rawSections,
    refinedSections: record.refinedSections,
    claudeUsage: record.claudeMetadata.usage,
    warnings: record.warnings,
    originalFileName: record.originalFileName,
    relativePath: record.storedFile.relativePath,
    claudeUsed: record.claudeMetadata.claudeUsed
  };
}

type UnknownTemplateRecord = Partial<TemplateRecord> &
  Partial<{ sections: string[]; claudeMetadata: TemplateClaudeMetadata; codexMetadata: TemplateClaudeMetadata }>;

function normalizeTemplateRecord(record: UnknownTemplateRecord): TemplateRecord {
  const rawSections = Array.isArray(record.rawSections)
    ? record.rawSections.filter((section): section is string => typeof section === 'string')
    : Array.isArray(record.sections)
      ? record.sections.filter((section): section is string => typeof section === 'string')
      : [];

  const refinedSections = Array.isArray(record.refinedSections)
    ? record.refinedSections.filter(isValidRefinedSection)
    : [];

  // Support backward compatibility with codexMetadata
  const metadata = record.claudeMetadata ?? record.codexMetadata;
  const claudeMetadata: TemplateClaudeMetadata = {
    claudeUsed: Boolean(metadata?.claudeUsed && refinedSections.length > 0),
    usage: metadata?.usage,
    lastRefinedAt: refinedSections.length
      ? metadata?.lastRefinedAt ?? record.createdAt ?? new Date().toISOString()
      : undefined
  };

  return {
    id: record.id ?? `template_${Date.now()}`,
    name: record.name ?? record.originalFileName ?? 'Untitled Template',
    originalFileName: record.originalFileName ?? record.name ?? 'template',
    storedFile: record.storedFile as StoredFileInfo,
    createdAt: record.createdAt ?? new Date().toISOString(),
    rawSections,
    refinedSections,
    claudeMetadata,
    warnings: record.warnings
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

function isValidRefinedSection(section: unknown): section is TemplateRefinedSection {
  return Boolean(
    section &&
    typeof section === 'object' &&
    typeof (section as TemplateRefinedSection).title === 'string' &&
    typeof (section as TemplateRefinedSection).summary === 'string' &&
    typeof (section as TemplateRefinedSection).originalHeading === 'string'
  );
}

export async function refineTemplateRecord(templateId: string): Promise<TemplateDetails> {
  const index = await loadIndex();
  const recordIndex = index.templates.findIndex((item) => item.id === templateId);

  if (recordIndex === -1) {
    throw new Error('Template not found');
  }

  const current = index.templates[recordIndex];
  const refinement = await refineExtractedSections(current.rawSections);
  const timestamp = new Date().toISOString();

  const updated: TemplateRecord = {
    ...current,
    refinedSections: refinement.sections,
    claudeMetadata: {
      claudeUsed: refinement.claudeUsed,
      usage: refinement.usage,
      lastRefinedAt: timestamp
    },
    warnings: combineWarnings(current.warnings, refinement.warnings)
  };

  index.templates.splice(recordIndex, 1);
  index.templates.unshift(updated);
  await saveIndex(index);

  return toTemplateDetails(updated);
}

/**
 * Refine template using agent with file operations and semtools
 */
export async function refineTemplateRecordWithAgent(templateId: string): Promise<TemplateDetails> {
  const index = await loadIndex();
  const recordIndex = index.templates.findIndex((item) => item.id === templateId);

  if (recordIndex === -1) {
    throw new Error('Template not found');
  }

  const current = index.templates[recordIndex];

  // Build absolute path to template file
  const templatePath = path.join(appConfig.templateRoot, current.storedFile.relativePath);

  // Use agent-based refinement
  const refinement = await refineTemplateSections(templatePath);
  const timestamp = new Date().toISOString();

  const updated: TemplateRecord = {
    ...current,
    refinedSections: refinement.sections,
    claudeMetadata: {
      claudeUsed: refinement.claudeUsed,
      usage: refinement.usage,
      lastRefinedAt: timestamp
    },
    warnings: combineWarnings(current.warnings, refinement.warnings)
  };

  index.templates.splice(recordIndex, 1);
  index.templates.unshift(updated);
  await saveIndex(index);

  return toTemplateDetails(updated);
}
