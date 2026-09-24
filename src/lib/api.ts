const rawUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3030';
export const API_URL = rawUrl.startsWith('http') ? rawUrl : `http://${rawUrl}`;

export interface AuthResult {
  ok: boolean;
  status: number;
  message?: string;
  username?: string;
  token?: string;
  lastOpenedProjectId?: string | null;
}

export interface ProjectResult {
  ok: boolean;
  status: number;
  message?: string;
  id?: string;
  name?: string;
}

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface ProjectListResult {
  ok: boolean;
  status: number;
  message?: string;
  projects?: Project[];
}

// The API sets its session cookie on its own (cross-site) domain, so the
// Next.js server components can never read it from the frontend origin.
// Auth responses therefore also return the raw token, which the client
// mirrors into this non-httpOnly cookie for server-side forwarding.
export function setSessionCookie(token: string): void {
  if (typeof document !== 'undefined') {
    document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
  }
}

export function clearSessionCookie(): void {
  if (typeof document !== 'undefined') {
    document.cookie = 'token=; path=/; max-age=0';
  }
}

async function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: object,
): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers:
        method === 'POST' || method === 'PATCH'
          ? { 'Content-Type': 'application/json' }
          : undefined,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...data } as T;
  } catch {
    return { ok: false, status: 0, message: 'incorrect credentials' } as T;
  }
}

async function post(path: string, body: object): Promise<AuthResult> {
  return request<AuthResult>(path, 'POST', body);
}

export function apiSignup(username: string, password: string): Promise<AuthResult> {
  return post('/auth/signup', { username, password });
}

export function apiLogin(username: string, password: string): Promise<AuthResult> {
  return post('/auth/login', { username, password });
}

export function apiCreateProject(name: string): Promise<ProjectResult> {
  return request<ProjectResult>('/projects', 'POST', { name });
}

export function apiListProjects(): Promise<ProjectListResult> {
  return request<ProjectListResult>('/projects', 'GET');
}

export function apiGetProject(id: string): Promise<ProjectResult> {
  return request<ProjectResult>(`/projects/${id}`, 'GET');
}

export function apiLogout(): Promise<AuthResult> {
  return request<AuthResult>('/auth/logout', 'POST');
}

export function apiRenameProject(
  id: string,
  name: string,
): Promise<ProjectResult> {
  return request<ProjectResult>(`/projects/${id}`, 'PATCH', { name });
}

export function apiDeleteProject(id: string): Promise<ProjectResult> {
  return request<ProjectResult>(`/projects/${id}`, 'DELETE');
}

// Uploads an XMI file to `POST /projects/import`, creating a new project
// from the parsed diagram.
export async function apiImportProjectXmi(
  file: File,
): Promise<ProjectResult> {
  try {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_URL}/projects/import`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...data } as ProjectResult;
  } catch {
    return { ok: false, status: 0, message: 'could not import project' };
  }
}

export type AiGenerateResult = ProjectResult;

export interface AiTranscribeResult {
  ok: boolean;
  status: number;
  message?: string;
  text?: string;
}

export interface AiImageResult {
  ok: boolean;
  status: number;
  message?: string;
  dsl?: string;
}

// Posts a multipart form to the backend without setting a JSON content
// type (the browser fills in the multipart boundary), with the same
// JSON error fallback as the other request helpers.
async function postForm<T>(
  path: string,
  form: FormData,
  fallbackMessage: string,
  timeoutMs?: number,
): Promise<T> {
  const controller = timeoutMs ? new AbortController() : undefined;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : undefined;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      body: form,
      signal: controller?.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...data } as T;
  } catch {
    return { ok: false, status: 0, message: fallbackMessage } as T;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

// Sends a text prompt to `POST /ai/generate`, which returns the created
// project's id and name. Local LLM inference can take minutes (the
// configured model runs a thinking phase before its constrained JSON
// output), so the timeout is generous (see design D8).
export function apiAiGenerate(prompt: string): Promise<AiGenerateResult> {
  const form = new FormData();
  form.append('prompt', prompt);
  return postForm<AiGenerateResult>(
    '/ai/generate',
    form,
    'could not generate the diagram',
    600_000,
  );
}

// Uploads recorded audio to `POST /ai/transcribe`, which returns the
// transcript text.
export function apiAiTranscribe(blob: Blob): Promise<AiTranscribeResult> {
  const form = new FormData();
  form.append('file', blob, 'clip.webm');
  return postForm<AiTranscribeResult>('/ai/transcribe', form, 'could not transcribe the recording');
}

// Uploads a class-diagram image to `POST /ai/image`, which returns the
// transcribed mini-DSL text.
export function apiAiImage(file: File): Promise<AiImageResult> {
  const form = new FormData();
  form.append('file', file);
  return postForm<AiImageResult>('/ai/image', form, 'could not read the image');
}

// Downloads a project's diagram as UML 2 XMI from `GET /projects/:id/xmi`
// and triggers a blob download in the browser.
export async function apiDownloadProjectXmi(
  id: string,
  fallbackName: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/projects/${id}/xmi`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`export failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fallbackName || 'diagram'}.xmi`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Downloads a generated Spring Boot project zip from
// `GET /projects/:id/spring-boot` and triggers a blob download in the
// browser. Local LLM generation can take minutes, so the timeout is
// generous (mirrors apiAiGenerate).
export async function apiDownloadProjectSpringBoot(
  id: string,
  fallbackName: string,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 600_000);
  try {
    const res = await fetch(`${API_URL}/projects/${id}/spring-boot`, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new Error(
        data.message ?? `export failed for "${fallbackName}" (${res.status})`,
      );
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spring-boot-project.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } finally {
    clearTimeout(timer);
  }
}

export async function apiGetProjectServer(
  id: string,
  cookie?: string,
): Promise<ProjectResult> {
  const data = await serverRequest(`/projects/${id}`, cookie);
  if (!data) {
    return { ok: false, status: 0, message: 'project not found' };
  }
  return {
    ok: true,
    status: 200,
    id: data.id as string,
    name: data.name as string,
  };
}

export async function apiLastOpenedProjectId(
  cookie?: string,
): Promise<string | null> {
  const data = (await serverRequest('/auth/me', cookie)) as
    | { lastOpenedProjectId?: string | null }
    | null;
  return data?.lastOpenedProjectId ?? null;
}

async function serverRequest(
  path: string,
  cookie?: string,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: cookie ? { Cookie: `token=${cookie}` } : undefined,
      cache: 'no-store',
    });
    if (res.status !== 200) {
      return null;
    }
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function apiMe(cookie?: string): Promise<string | null> {
  const data = (await serverRequest('/auth/me', cookie)) as
    | { username?: string }
    | null;
  return data?.username ?? null;
}
