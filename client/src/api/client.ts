import type { ApiError, AuthResponse } from './types';

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:43124';

/** Jeton d'accès gardé en mémoire uniquement (jamais dans localStorage). */
let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;
let refreshing: Promise<AuthResponse | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setSessionLostHandler(handler: (() => void) | null): void {
  onSessionLost = handler;
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiError['error']['code'] | 'NETWORK',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

async function rawFetch(path: string, init: RequestInit = {}, token = accessToken): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    return await fetch(API_URL + path, { ...init, headers, credentials: 'include' });
  } catch {
    throw new ApiRequestError(0, 'NETWORK', 'Serveur injoignable');
  }
}

async function toError(res: Response): Promise<ApiRequestError> {
  try {
    const body = (await res.json()) as ApiError;
    return new ApiRequestError(res.status, body.error.code, body.error.message, body.error.details);
  } catch {
    return new ApiRequestError(res.status, 'INTERNAL', `Erreur ${res.status}`);
  }
}

/** Un seul refresh à la fois, même si plusieurs requêtes reçoivent un 401 en même temps. */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= (async () => {
    try {
      const res = await rawFetch('/auth/refresh', { method: 'POST' }, null);
      if (!res.ok) return null;
      const body = (await res.json()) as AuthResponse;
      accessToken = body.accessToken;
      return body;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Requête JSON ; sur 401, tente un refresh puis rejoue une fois. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await rawFetch(path, init);
  if (res.status === 401 && accessToken !== null && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await rawFetch(path, init);
    } else {
      accessToken = null;
      onSessionLost?.();
    }
  }
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
export const put = <T>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const del = (path: string) => api<void>(path, { method: 'DELETE' });
