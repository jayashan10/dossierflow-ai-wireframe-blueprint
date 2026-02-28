const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export interface SourceSummary {
  id: string;
  name: string;
  type: string;
  path?: string;
  tags?: string[];
  createdAt?: string;
}

export interface GenerateRequestBody {
  sectionId: string;
  sectionTitle: string;
  prompt: string;
  selectedSourceIds: string[];
}

export interface GenerateResponseBody {
  content: string;
  metadata: Record<string, unknown> & {
    sectionId: string;
    sectionTitle: string;
    sources: Array<{ id: string; name: string; warnings?: string[] | undefined }>;
    claudeUsed?: boolean;
    codexUsed?: boolean;
    snippetCount?: number;
  };
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface TemplateSummary {
  id: string;
  name: string;
  sectionCount: number;
  createdAt: string;
  claudeUsed: boolean;
}

export interface TemplateRefinedSection {
  title: string;
  summary: string;
  originalHeading: string;
}

export interface TemplateDetails extends TemplateSummary {
  rawSections: string[];
  refinedSections: TemplateRefinedSection[];
  claudeUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  warnings?: string[];
  originalFileName: string;
  relativePath: string;
}

interface UploadTemplateResponse {
  template: TemplateDetails;
}

interface RefineTemplateResponse {
  template: TemplateDetails;
}

export async function fetchSources(search?: string): Promise<SourceSummary[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);

  const response = await fetch(`${API_BASE_URL}/api/sources?${params.toString()}`);
  const data = await handleResponse<{ sources: SourceSummary[] }>(response);
  return data.sources;
}

export async function fetchProgramSources(programId: string, search?: string): Promise<SourceSummary[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);

  const response = await fetch(
    `${API_BASE_URL}/api/programs/${encodeURIComponent(programId)}/sources?${params.toString()}`
  );
  const data = await handleResponse<{ sources: SourceSummary[] }>(response);
  return data.sources;
}

export async function generateContent(body: GenerateRequestBody): Promise<GenerateResponseBody> {
  const response = await fetch(`${API_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  return handleResponse<GenerateResponseBody>(response);
}

export async function uploadTemplate(file: File): Promise<TemplateDetails> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/templates/upload`, {
    method: 'POST',
    body: formData
  });

  const data = await handleResponse<UploadTemplateResponse>(response);
  return data.template;
}

export async function listTemplates(): Promise<TemplateSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/templates`);
  const data = await handleResponse<{ templates: TemplateSummary[] }>(response);
  return data.templates;
}

export async function refineTemplate(templateId: string): Promise<TemplateDetails> {
  const response = await fetch(`${API_BASE_URL}/api/templates/${templateId}/refine`, {
    method: 'POST'
  });

  const data = await handleResponse<RefineTemplateResponse>(response);
  return data.template;
}

export interface UploadSourcesResponse {
  sources: SourceSummary[];
  warnings?: string[];
}

export async function uploadSources(files: File[]): Promise<UploadSourcesResponse> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await fetch(`${API_BASE_URL}/api/sources/upload`, {
    method: 'POST',
    body: formData
  });

  return handleResponse<UploadSourcesResponse>(response);
}

export async function updateSourceTags(
  sourceId: string,
  tags: string[]
): Promise<SourceSummary> {
  const response = await fetch(`${API_BASE_URL}/api/sources/${sourceId}/tags`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags })
  });

  const data = await handleResponse<{ source: SourceSummary }>(response);
  return data.source;
}

// Streaming generation types
export interface StreamEvent {
  type:
    | 'run_started'
    | 'run_completed'
    | 'run_cancelled'
    | 'sync_failed'
    | 'text'
    | 'tool_start'
    | 'tool_result'
    | 'thinking'
    | 'complete'
    | 'error';
  content?: string;
  tool?: string;
  input?: unknown;
  output?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  error?: string;
  runId?: string;
  toolsUsed?: string[];
  turnsCompleted?: number;
  path?: string;
  details?: Record<string, unknown>;
}

export interface StreamGenerateRequest {
  sectionId: string;
  sectionTitle: string;
  prompt: string;
  selectedSourceIds: string[];
  mentionedFileIds: string[];
  runId?: string;
}

export function streamGenerateContent(
  body: StreamGenerateRequest,
  callbacks: {
    onEvent: (event: StreamEvent) => void;
    onComplete: () => void;
    onError: (error: string) => void;
  }
): () => void {
  const controller = new AbortController();

  fetch(`${API_BASE_URL}/api/generate/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed with status ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            callbacks.onComplete();
            return;
          }

          try {
            const event = JSON.parse(data) as StreamEvent;
            callbacks.onEvent(event);
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }

      callbacks.onComplete();
    })
    .catch((error) => {
      if (error.name === 'AbortError') {
        return; // Ignore abort errors
      }
      callbacks.onError(error instanceof Error ? error.message : 'Unknown error');
    });

  // Return cancel function
  return () => controller.abort();
}

// ============================================================================
// Inline Refinement API
// ============================================================================

export type RefineAction = 'improve' | 'expand' | 'simplify' | 'add_references' | 'rewrite' | 'make_concise' | 'formal_tone' | 'custom';

export interface RefineRequest {
  selectedText: string;
  action: RefineAction;
  customInstruction?: string;
  sectionTitle?: string;
  surroundingContext?: string;
}

export function streamRefineSelection(
  body: RefineRequest,
  callbacks: {
    onText: (text: string) => void;
    onComplete: (fullText: string) => void;
    onError: (error: string) => void;
  }
): () => void {
  const controller = new AbortController();

  fetch(`${API_BASE_URL}/api/generate/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed with status ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            callbacks.onComplete(fullText);
            return;
          }
          try {
            const event = JSON.parse(data) as StreamEvent;
            if (event.type === 'text' && event.content) {
              fullText += event.content;
              callbacks.onText(event.content);
            } else if (event.type === 'complete' && event.content) {
              fullText = event.content;
            } else if (event.type === 'error' && event.error) {
              callbacks.onError(event.error);
              return;
            }
          } catch {
            // ignore parse errors
          }
        }
      }
      callbacks.onComplete(fullText);
    })
    .catch((error) => {
      if (error.name === 'AbortError') return;
      callbacks.onError(error instanceof Error ? error.message : 'Unknown error');
    });

  return () => controller.abort();
}

// ============================================================================
// Program API
// ============================================================================

export interface ProgramSummary {
  id: string;
  name: string;
  folderName: string;
  createdAt: string;
  sectionCount: number;
  hasTemplate: boolean;
}

export interface ProgramSection {
  title: string;
  summary?: string;
  path: string;
  status: 'pending' | 'draft' | 'reviewed' | 'approved';
  order?: number;
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

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
  children?: FileNode[];
}

export async function listPrograms(): Promise<ProgramSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/programs`);
  const data = await handleResponse<{ programs: ProgramSummary[] }>(response);
  return data.programs;
}

export async function createProgram(name: string): Promise<ProgramMetadata> {
  const response = await fetch(`${API_BASE_URL}/api/programs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  const data = await handleResponse<{ program: ProgramMetadata }>(response);
  return data.program;
}

export async function getProgram(programId: string): Promise<ProgramMetadata> {
  const response = await fetch(`${API_BASE_URL}/api/programs/${encodeURIComponent(programId)}`);
  const data = await handleResponse<{ program: ProgramMetadata }>(response);
  return data.program;
}

export async function deleteProgram(programId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/programs/${encodeURIComponent(programId)}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to delete program');
  }
}

export async function fetchProgramFiles(programId: string): Promise<FileNode[]> {
  const response = await fetch(`${API_BASE_URL}/api/programs/${encodeURIComponent(programId)}/files`);
  const data = await handleResponse<{ files: FileNode[] }>(response);
  return data.files;
}

export async function fetchFileContent(programId: string, filePath: string): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}/api/programs/${encodeURIComponent(programId)}/files/${encodeURIComponent(filePath)}`
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to fetch file');
  }
  return response.text();
}

export async function saveFileContent(programId: string, filePath: string, content: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/programs/${encodeURIComponent(programId)}/files/${encodeURIComponent(filePath)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    }
  );
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to save file');
  }
}

export async function uploadProgramTemplate(programId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `${API_BASE_URL}/api/programs/${encodeURIComponent(programId)}/template`,
    {
      method: 'POST',
      body: formData
    }
  );
  const data = await handleResponse<{ success: boolean; path: string }>(response);
  return data.path;
}

export async function uploadProgramSource(programId: string, file: File): Promise<SourceSummary> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `${API_BASE_URL}/api/programs/${encodeURIComponent(programId)}/sources`,
    {
      method: 'POST',
      body: formData
    }
  );
  const data = await handleResponse<{ source: SourceSummary }>(response);
  return data.source;
}

// Extended stream generate request with program support
export interface StreamGenerateWithProgramRequest extends StreamGenerateRequest {
  programId?: string;
  targetPath?: string;
}

export interface FileWrittenEvent {
  type: 'file_written';
  runId?: string;
  path: string;
  programId: string;
}

export interface ReviewComment {
  id: string;
  author: string;
  createdAt: string;
  text: string;
  section: string;
  replies?: ReviewComment[];
}

export interface SectionReviewState {
  status: 'drafting' | 'in_review' | 'changes_requested' | 'approved';
  assignedReviewers: string[];
  submissionNote?: string;
  comments: ReviewComment[];
  updatedAt: string;
}

export function streamGenerateContentWithProgram(
  body: StreamGenerateWithProgramRequest,
  callbacks: {
    onEvent: (event: StreamEvent | FileWrittenEvent) => void;
    onComplete: () => void;
    onError: (error: string) => void;
  }
): () => void {
  const controller = new AbortController();

  fetch(`${API_BASE_URL}/api/generate/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed with status ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            callbacks.onComplete();
            return;
          }

          try {
            const event = JSON.parse(data) as StreamEvent | FileWrittenEvent;
            callbacks.onEvent(event);
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }

      callbacks.onComplete();
    })
    .catch((error) => {
      if (error.name === 'AbortError') {
        return; // Ignore abort errors
      }
      callbacks.onError(error instanceof Error ? error.message : 'Unknown error');
    });

  // Return cancel function
  return () => controller.abort();
}

// ============================================================================
// Structure Creation
// ============================================================================

export interface CreateStructureRequest {
  sections: Array<{ title: string; summary?: string; originalHeading?: string }>;
}

export interface CreateStructureResponse {
  success: boolean;
  filesCreated: Array<{ path: string; section: string }>;
  sectionRoot?: string;
  warnings?: string[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export async function createProgramStructure(
  programId: string,
  sections: CreateStructureRequest['sections']
): Promise<CreateStructureResponse> {
  const response = await fetch(`${API_BASE_URL}/api/programs/${encodeURIComponent(programId)}/structure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sections })
  });

  if (!response.ok) {
    const text = await response.text();
    try {
      const error = JSON.parse(text);
      throw new Error(error.message || `Failed to create structure: ${response.status}`);
    } catch {
      throw new Error(text || `Failed to create structure: ${response.status}`);
    }
  }

  return response.json();
}

export async function updateProgramSection(
  programId: string,
  sectionKey: string,
  updates: Pick<ProgramSection, 'status' | 'tokenUsage'>
): Promise<ProgramSection> {
  const response = await fetch(
    `${API_BASE_URL}/api/programs/${encodeURIComponent(programId)}/sections/${encodeURIComponent(sectionKey)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }
  );

  const data = await handleResponse<{ section: ProgramSection }>(response);
  return data.section;
}

export async function fetchSectionReviewState(
  programId: string,
  sectionKey: string
): Promise<SectionReviewState | null> {
  const response = await fetch(
    `${API_BASE_URL}/api/programs/${encodeURIComponent(programId)}/reviews/${encodeURIComponent(sectionKey)}`
  );

  const data = await handleResponse<{ reviewState: SectionReviewState | null }>(response);
  return data.reviewState;
}

export async function saveSectionReviewState(
  programId: string,
  sectionKey: string,
  reviewState: Omit<SectionReviewState, 'updatedAt'>
): Promise<SectionReviewState> {
  const response = await fetch(
    `${API_BASE_URL}/api/programs/${encodeURIComponent(programId)}/reviews/${encodeURIComponent(sectionKey)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewState)
    }
  );

  const data = await handleResponse<{ reviewState: SectionReviewState }>(response);
  return data.reviewState;
}
