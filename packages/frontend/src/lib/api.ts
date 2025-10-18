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
}

export interface TemplateDetails extends TemplateSummary {
  sections: string[];
  warnings?: string[];
  originalFileName: string;
  relativePath: string;
}

interface UploadTemplateResponse {
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
