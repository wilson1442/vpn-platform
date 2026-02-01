'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== 'undefined') {
    localStorage.setItem('refreshToken', refresh);
  }
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('refreshToken');
  }
}

export function getStoredRefreshToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('refreshToken');
  }
  return null;
}

async function refreshAccessToken(): Promise<boolean> {
  const rt = refreshToken || getStoredRefreshToken();
  if (!rt) return false;

  try {
    const resp = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let resp = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (resp.status === 401 && (refreshToken || getStoredRefreshToken())) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.Authorization = `Bearer ${accessToken}`;
      resp = await fetch(`${API_URL}${path}`, { ...options, headers });
    }
  }

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.message || `API error: ${resp.status}`);
  }

  if (resp.status === 204) return undefined as T;
  return resp.json();
}

export async function apiRaw(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let resp = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (resp.status === 401 && (refreshToken || getStoredRefreshToken())) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.Authorization = `Bearer ${accessToken}`;
      resp = await fetch(`${API_URL}${path}`, { ...options, headers });
    }
  }

  if (!resp.ok) {
    throw new Error(`API error: ${resp.status}`);
  }

  return resp;
}

export async function apiUpload<T = any>(path: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = {};

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let resp = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (resp.status === 401 && (refreshToken || getStoredRefreshToken())) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.Authorization = `Bearer ${accessToken}`;
      resp = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers,
        body: formData,
      });
    }
  }

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.message || `API error: ${resp.status}`);
  }

  return resp.json();
}
