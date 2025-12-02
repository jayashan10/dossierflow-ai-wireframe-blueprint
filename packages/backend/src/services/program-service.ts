import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { appConfig } from '../config';

const PROGRAM_METADATA_FILENAME = 'program.json';

// ============================================================================
// Types
// ============================================================================

export interface ProgramSection {
  title: string;
  path: string;
  status: 'pending' | 'draft' | 'reviewed' | 'approved';
  generatedAt?: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ProgramMetadata {
  id: string;
  name: string;
  folderName: string;
  createdAt: string;
  updatedAt: string;
  templateFile?: string;
  sectionRoot?: string;
  sections: Record<string, ProgramSection>;
  linkedSources: string[];
}

export interface ProgramSummary {
  id: string;
  name: string;
  folderName: string;
  createdAt: string;
  sectionCount: number;
  hasTemplate: boolean;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
  children?: FileNode[];
}

// ============================================================================
// Utilities
// ============================================================================

function sanitizeFolderName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100) || 'program';
}

function generateProgramId(): string {
  return `program_${crypto.randomUUID()}`;
}

function getProgramPath(folderName: string): string {
  return path.join(appConfig.outputsRoot, folderName);
}

function getMetadataPath(folderName: string): string {
  return path.join(getProgramPath(folderName), PROGRAM_METADATA_FILENAME);
}

async function ensureProgramFolderStructure(programPath: string): Promise<void> {
  const folders = [
    programPath,
    path.join(programPath, '.claude'),
    path.join(programPath, '.claude', 'skills'),
    path.join(programPath, '.claude', 'subagents'),
    path.join(programPath, 'sources'),
    path.join(programPath, 'template')
  ];

  for (const folder of folders) {
    await fs.mkdir(folder, { recursive: true });
  }
}

// ============================================================================
// Program CRUD Operations
// ============================================================================

export async function createProgram(name: string): Promise<ProgramMetadata> {
  const folderName = sanitizeFolderName(name);
  const programPath = getProgramPath(folderName);

  // Check if folder already exists
  if (fsSync.existsSync(programPath)) {
    throw new Error(`Program folder "${folderName}" already exists. Please choose a different name.`);
  }

  // Create folder structure
  await ensureProgramFolderStructure(programPath);

  // Create metadata
  const timestamp = new Date().toISOString();
  const metadata: ProgramMetadata = {
    id: generateProgramId(),
    name,
    folderName,
    createdAt: timestamp,
    updatedAt: timestamp,
    sections: {},
    linkedSources: []
  };

  // Save metadata
  await fs.writeFile(getMetadataPath(folderName), JSON.stringify(metadata, null, 2), 'utf8');

  return metadata;
}

export async function getProgram(folderName: string): Promise<ProgramMetadata | null> {
  const metadataPath = getMetadataPath(folderName);

  try {
    const raw = await fs.readFile(metadataPath, 'utf8');
    return JSON.parse(raw) as ProgramMetadata;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function updateProgram(folderName: string, updates: Partial<ProgramMetadata>): Promise<ProgramMetadata> {
  const current = await getProgram(folderName);
  if (!current) {
    throw new Error(`Program "${folderName}" not found.`);
  }

  const updated: ProgramMetadata = {
    ...current,
    ...updates,
    id: current.id, // Prevent id from being changed
    folderName: current.folderName, // Prevent folderName from being changed
    createdAt: current.createdAt, // Prevent createdAt from being changed
    updatedAt: new Date().toISOString()
  };

  await fs.writeFile(getMetadataPath(folderName), JSON.stringify(updated, null, 2), 'utf8');

  return updated;
}

export async function deleteProgram(folderName: string): Promise<void> {
  const programPath = getProgramPath(folderName);

  if (!fsSync.existsSync(programPath)) {
    throw new Error(`Program "${folderName}" not found.`);
  }

  await fs.rm(programPath, { recursive: true, force: true });
}

export async function listPrograms(): Promise<ProgramSummary[]> {
  const outputsRoot = appConfig.outputsRoot;
  const entries = await fs.readdir(outputsRoot, { withFileTypes: true });
  const programs: ProgramSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const metadata = await getProgram(entry.name);
    if (!metadata) continue;

    programs.push({
      id: metadata.id,
      name: metadata.name,
      folderName: metadata.folderName,
      createdAt: metadata.createdAt,
      sectionCount: Object.keys(metadata.sections).length,
      hasTemplate: Boolean(metadata.templateFile)
    });
  }

  // Sort by createdAt descending
  programs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return programs;
}

// ============================================================================
// File Operations
// ============================================================================

export async function listProgramFiles(folderName: string): Promise<FileNode[]> {
  const programPath = getProgramPath(folderName);

  if (!fsSync.existsSync(programPath)) {
    throw new Error(`Program "${folderName}" not found.`);
  }

  async function buildTree(dirPath: string, relativeTo: string): Promise<FileNode[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(relativeTo, fullPath);

      if (entry.isDirectory()) {
        const children = await buildTree(fullPath, relativeTo);
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: 'directory',
          children
        });
      } else {
        const stats = await fs.stat(fullPath);
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: 'file',
          size: stats.size,
          modifiedAt: stats.mtime.toISOString()
        });
      }
    }

    // Sort: directories first, then files, alphabetically
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return nodes;
  }

  return buildTree(programPath, programPath);
}

export async function readProgramFile(folderName: string, filePath: string): Promise<string> {
  const programPath = getProgramPath(folderName);
  const absolutePath = path.join(programPath, filePath);

  // Security: Ensure path is within program folder
  const normalizedProgramPath = path.resolve(programPath);
  const normalizedFilePath = path.resolve(absolutePath);

  if (!normalizedFilePath.startsWith(normalizedProgramPath)) {
    throw new Error('Path traversal detected. Access denied.');
  }

  if (!fsSync.existsSync(absolutePath)) {
    throw new Error(`File "${filePath}" not found.`);
  }

  const stats = await fs.stat(absolutePath);
  if (stats.isDirectory()) {
    throw new Error(`Cannot read directory "${filePath}".`);
  }

  return fs.readFile(absolutePath, 'utf8');
}

export async function writeProgramFile(folderName: string, filePath: string, content: string): Promise<void> {
  const programPath = getProgramPath(folderName);
  const absolutePath = path.join(programPath, filePath);

  // Security: Ensure path is within program folder
  const normalizedProgramPath = path.resolve(programPath);
  const normalizedFilePath = path.resolve(absolutePath);

  if (!normalizedFilePath.startsWith(normalizedProgramPath)) {
    throw new Error('Path traversal detected. Access denied.');
  }

  // Create parent directories if needed
  const parentDir = path.dirname(absolutePath);
  await fs.mkdir(parentDir, { recursive: true });

  await fs.writeFile(absolutePath, content, 'utf8');

  // Update program metadata if this is a section file
  if (filePath.endsWith('content.md') || filePath.endsWith('.md')) {
    const metadata = await getProgram(folderName);
    if (metadata) {
      metadata.updatedAt = new Date().toISOString();
      await fs.writeFile(getMetadataPath(folderName), JSON.stringify(metadata, null, 2), 'utf8');
    }
  }
}

export async function createProgramFile(folderName: string, filePath: string, content: string): Promise<void> {
  const programPath = getProgramPath(folderName);
  const absolutePath = path.join(programPath, filePath);

  // Security: Ensure path is within program folder
  const normalizedProgramPath = path.resolve(programPath);
  const normalizedFilePath = path.resolve(absolutePath);

  if (!normalizedFilePath.startsWith(normalizedProgramPath)) {
    throw new Error('Path traversal detected. Access denied.');
  }

  // Check if file already exists
  if (fsSync.existsSync(absolutePath)) {
    throw new Error(`File "${filePath}" already exists.`);
  }

  // Create parent directories if needed
  const parentDir = path.dirname(absolutePath);
  await fs.mkdir(parentDir, { recursive: true });

  await fs.writeFile(absolutePath, content, 'utf8');
}

export async function deleteProgramFile(folderName: string, filePath: string): Promise<void> {
  const programPath = getProgramPath(folderName);
  const absolutePath = path.join(programPath, filePath);

  // Security: Ensure path is within program folder
  const normalizedProgramPath = path.resolve(programPath);
  const normalizedFilePath = path.resolve(absolutePath);

  if (!normalizedFilePath.startsWith(normalizedProgramPath)) {
    throw new Error('Path traversal detected. Access denied.');
  }

  // Don't allow deleting program.json
  if (filePath === PROGRAM_METADATA_FILENAME) {
    throw new Error('Cannot delete program metadata file.');
  }

  if (!fsSync.existsSync(absolutePath)) {
    throw new Error(`File "${filePath}" not found.`);
  }

  const stats = await fs.stat(absolutePath);
  if (stats.isDirectory()) {
    await fs.rm(absolutePath, { recursive: true, force: true });
  } else {
    await fs.unlink(absolutePath);
  }
}

// ============================================================================
// Source Linking
// ============================================================================

export async function linkSourceToProgram(folderName: string, sourcePath: string): Promise<string> {
  const programPath = getProgramPath(folderName);
  const sourcesDir = path.join(programPath, 'sources');
  const fileName = path.basename(sourcePath);
  const destPath = path.join(sourcesDir, fileName);

  // Copy the file
  await fs.copyFile(sourcePath, destPath);

  // Update metadata
  const metadata = await getProgram(folderName);
  if (metadata) {
    const relativePath = `sources/${fileName}`;
    if (!metadata.linkedSources.includes(relativePath)) {
      metadata.linkedSources.push(relativePath);
      await updateProgram(folderName, { linkedSources: metadata.linkedSources });
    }
  }

  return `sources/${fileName}`;
}

// ============================================================================
// Template Handling
// ============================================================================

export async function saveTemplateToProgram(
  folderName: string,
  templateBuffer: Buffer,
  originalFileName: string
): Promise<string> {
  const programPath = getProgramPath(folderName);
  const templateDir = path.join(programPath, 'template');
  const ext = path.extname(originalFileName);
  const destPath = path.join(templateDir, `original${ext}`);

  await fs.writeFile(destPath, templateBuffer);

  // Update metadata
  await updateProgram(folderName, { templateFile: `template/original${ext}` });

  return `template/original${ext}`;
}

// ============================================================================
// Section Management
// ============================================================================

export async function updateSectionStatus(
  folderName: string,
  sectionId: string,
  status: ProgramSection['status'],
  tokenUsage?: ProgramSection['tokenUsage']
): Promise<void> {
  const metadata = await getProgram(folderName);
  if (!metadata) {
    throw new Error(`Program "${folderName}" not found.`);
  }

  if (!metadata.sections[sectionId]) {
    throw new Error(`Section "${sectionId}" not found in program.`);
  }

  metadata.sections[sectionId].status = status;
  if (status === 'draft') {
    metadata.sections[sectionId].generatedAt = new Date().toISOString();
  }
  if (tokenUsage) {
    metadata.sections[sectionId].tokenUsage = tokenUsage;
  }

  await updateProgram(folderName, { sections: metadata.sections });
}

export async function addSection(
  folderName: string,
  sectionId: string,
  section: ProgramSection
): Promise<void> {
  const metadata = await getProgram(folderName);
  if (!metadata) {
    throw new Error(`Program "${folderName}" not found.`);
  }

  metadata.sections[sectionId] = section;
  await updateProgram(folderName, { sections: metadata.sections });
}

export async function setSections(
  folderName: string,
  sections: Record<string, ProgramSection>,
  sectionRoot?: string
): Promise<void> {
  const updates: Partial<ProgramMetadata> = { sections };
  if (sectionRoot) {
    updates.sectionRoot = sectionRoot;
  }
  await updateProgram(folderName, updates);
}

// ============================================================================
// Utility: Get absolute path for agent operations
// ============================================================================

export function getProgramAbsolutePath(folderName: string): string {
  return getProgramPath(folderName);
}
