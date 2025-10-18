import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const INVALID_FILENAME_CHARS = /[^a-zA-Z0-9._-]/g;

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream'
]);

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB

export interface UploadedFile {
  originalName: string;
  mimeType?: string;
  size: number;
  buffer: Buffer;
}

export interface StoredFileInfo {
  id: string;
  originalName: string;
  sanitizedFileName: string;
  mimeType?: string;
  extension: string;
  size: number;
  relativePath: string;
  absolutePath: string;
}

interface PersistUploadOptions {
  rootDirectory: string;
  prefix?: string;
  upload: UploadedFile;
}

export class FileValidationError extends Error {
  status = 400;
  details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

function ensureWithinRoot(rootDirectory: string, targetPath: string) {
  const normalizedRoot = path.resolve(rootDirectory);
  const normalizedTarget = path.resolve(targetPath);

  if (!normalizedTarget.startsWith(normalizedRoot)) {
    throw new FileValidationError('Resolved path escapes storage root.');
  }
}

function sanitizeFileName(original: string): string {
  const trimmed = original.trim();
  const baseName = path.basename(trimmed || 'file');
  const dotIndex = baseName.lastIndexOf('.');

  const name = dotIndex === -1 ? baseName : baseName.slice(0, dotIndex);
  const extension = dotIndex === -1 ? '' : baseName.slice(dotIndex);

  const safeName = name.replace(INVALID_FILENAME_CHARS, '-').replace(/-+/g, '-');
  const safeExtension = extension.replace(INVALID_FILENAME_CHARS, '').toLowerCase();

  const normalizedName = safeName.length > 0 ? safeName : 'file';
  return `${normalizedName}${safeExtension}`;
}

function validateUpload(upload: UploadedFile): { extension: string; mimeType?: string } {
  if (!upload.originalName) {
    throw new FileValidationError('File name is required.');
  }

  if (upload.size <= 0) {
    throw new FileValidationError('File is empty.');
  }

  if (upload.size > MAX_FILE_SIZE_BYTES) {
    throw new FileValidationError('File exceeds maximum allowed size (10 MB).');
  }

  const sanitized = sanitizeFileName(upload.originalName);
  const extension = path.extname(sanitized).toLowerCase();
  const mimeType = upload.mimeType?.toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new FileValidationError(`Unsupported file extension: ${extension || 'unknown'}.`, {
      extension
    });
  }

  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new FileValidationError(`Unsupported MIME type: ${mimeType}.`, {
      mimeType
    });
  }

  return { extension, mimeType: mimeType || undefined };
}

export function generateId(prefix = 'file'): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function persistUploadedFile({
  rootDirectory,
  prefix,
  upload
}: PersistUploadOptions): Promise<StoredFileInfo> {
  const sanitizedFileName = sanitizeFileName(upload.originalName);
  const { extension, mimeType } = validateUpload({ ...upload, originalName: sanitizedFileName });

  const fileId = generateId(prefix);
  const targetDirectory = path.join(rootDirectory, fileId);
  const absoluteDirectory = path.resolve(targetDirectory);
  const absolutePath = path.join(absoluteDirectory, sanitizedFileName);

  ensureWithinRoot(rootDirectory, absolutePath);

  await fs.mkdir(absoluteDirectory, { recursive: true });
  await fs.writeFile(absolutePath, upload.buffer);

  return {
    id: fileId,
    originalName: upload.originalName,
    sanitizedFileName,
    extension,
    mimeType,
    size: upload.size,
    relativePath: path.relative(path.resolve(rootDirectory), absolutePath),
    absolutePath
  };
}

export async function removeStoredFile(rootDirectory: string, relativePath: string): Promise<void> {
  const absolutePath = path.resolve(rootDirectory, relativePath);
  ensureWithinRoot(rootDirectory, absolutePath);

  await fs.rm(absolutePath, { force: true });
}

export function isAllowedExtension(extension: string): boolean {
  return ALLOWED_EXTENSIONS.has(extension.toLowerCase());
}

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
}

export function getAllowedExtensions(): string[] {
  return Array.from(ALLOWED_EXTENSIONS);
}

export function getAllowedMimeTypes(): string[] {
  return Array.from(ALLOWED_MIME_TYPES);
}

