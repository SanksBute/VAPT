import type { ApiResponse } from '@sentinelx/shared';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
const API_VERSION = 'v1';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
    public readonly errors?: Array<{ code: string; message: string; field?: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getBaseUrl(): string {
  return `${API_URL}/api/${API_VERSION}`;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Access token from localStorage (CSR) or cookie
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const orgId = localStorage.getItem('organization_id');
    if (orgId) {
      headers['X-Organization-ID'] = orgId;
    }
  }

  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!response.ok) {
    if (isJson) {
      const error = await response.json() as ApiResponse<null>;
      throw new ApiError(
        response.status,
        error.message ?? 'An error occurred',
        error.errors?.[0]?.code,
        error.errors,
      );
    }
    throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`);
  }

  if (!isJson) return null as T;

  const data = await response.json() as ApiResponse<T>;
  return data.data;
}

export async function apiGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const url = new URL(`${getBaseUrl()}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((v) => url.searchParams.append(key, String(v)));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: await getAuthHeaders(),
    credentials: 'include',
  });

  return handleResponse<T>(response);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return handleResponse<T>(response);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return handleResponse<T>(response);
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return handleResponse<T>(response);
}

export async function apiDelete<T = void>(path: string): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
    credentials: 'include',
  });

  if (response.status === 204) return undefined as T;
  return handleResponse<T>(response);
}

export async function* apiStream(
  path: string,
  body?: unknown,
): AsyncGenerator<{ delta: string; content: string; isComplete: boolean }> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok || !response.body) {
    throw new ApiError(response.status, 'Stream request failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') return;

        try {
          const chunk = JSON.parse(data) as { delta: string; content: string; isComplete: boolean };
          yield chunk;
        } catch {
          continue;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
