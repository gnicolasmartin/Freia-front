/**
 * API Client — thin wrapper around fetch for backend communication.
 *
 * Base URL is set via NEXT_PUBLIC_API_URL environment variable.
 * Storage mode is controlled by NEXT_PUBLIC_STORAGE_MODE:
 *   - "local"  → providers use localStorage (current behavior, default)
 *   - "api"    → providers use this client to call the backend API
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/** Whether the app should use the backend API instead of localStorage. */
export const USE_API = process.env.NEXT_PUBLIC_STORAGE_MODE === 'api';

/** Current environment name (for display purposes). */
export const APP_ENV =
  process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body.message || `API error ${res.status}`,
    );
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data) }),

  put: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),

  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};
