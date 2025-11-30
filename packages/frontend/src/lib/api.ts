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
  type: 'text' | 'tool_start' | 'tool_result' | 'thinking' | 'complete' | 'error';
  content?: string;
  tool?: string;
  input?: unknown;
  output?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  error?: string;
}

export interface StreamGenerateRequest {
  sectionId: string;
  sectionTitle: string;
  prompt: string;
  selectedSourceIds: string[];
  mentionedFileIds: string[];
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
