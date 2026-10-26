import { BikeCounterEntry, BikeCounterHistory, BikeCounterStats, BikeHistoryRange } from "./types";

const storageKey = "dervenn-basic-auth";
const DEFAULT_API_BASE_URL = "https://n4l6c21u76.execute-api.eu-west-3.amazonaws.com/prod";
let runtimeApiBaseUrl = "";

export async function loadRuntimeConfig(): Promise<void> {
  try {
    const response = await fetch("/runtime-config.json", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { apiBaseUrl?: string };
    runtimeApiBaseUrl = (data.apiBaseUrl ?? "").replace(/\/$/, "");
  } catch {
    runtimeApiBaseUrl = "";
  }
}

export function getApiBaseUrl(): string {
  const configured = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "").replace(/\/$/, "");
  return configured || runtimeApiBaseUrl || DEFAULT_API_BASE_URL;
}

export function saveCredentials(username: string, password: string): void {
  window.sessionStorage.setItem(storageKey, btoa(`${username}:${password}`));
}

export function clearCredentials(): void {
  window.sessionStorage.removeItem(storageKey);
}

export function hasCredentials(): boolean {
  return Boolean(window.sessionStorage.getItem(storageKey));
}

function getAuthorizationHeader(): string {
  const token = window.sessionStorage.getItem(storageKey);

  if (!token) {
    throw new Error("Missing credentials");
  }

  return `Basic ${token}`;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiBaseUrl = getApiBaseUrl();

  if (!apiBaseUrl) {
    throw new Error("URL API non configuree");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthorizationHeader(),
      ...(init?.headers ?? {})
    }
  });

  if (response.status === 401 || response.status === 403) {
    clearCredentials();
    throw new Error("Authentification invalide");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? body.message ?? "Erreur API");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function getBikeCounterStats(): Promise<BikeCounterStats> {
  const data = await apiFetch<{ stats: BikeCounterStats }>("/bike/stats");
  return data.stats;
}

export async function recalculateBikeCounterStats(): Promise<BikeCounterStats> {
  const data = await apiFetch<{ stats: BikeCounterStats }>("/bike/stats", {
    method: "POST"
  });
  return data.stats;
}

export async function setBikeSessionCount(sessionCount: number): Promise<BikeCounterStats> {
  const data = await apiFetch<{ stats: BikeCounterStats }>("/bike/session", {
    method: "POST",
    body: JSON.stringify({ sessionCount })
  });
  return data.stats;
}

export async function getBikeCounterHistory(range: BikeHistoryRange): Promise<BikeCounterHistory> {
  const data = await apiFetch<{ history: BikeCounterHistory }>(`/bike/history?range=${encodeURIComponent(range)}`);
  return data.history;
}

export async function getBikeCounterEvents(
  from: string,
  to: string,
  limit = 200
): Promise<BikeCounterEntry[]> {
  const params = new URLSearchParams({
    from,
    to,
    limit: String(limit)
  });
  const data = await apiFetch<{ entries: BikeCounterEntry[] }>(`/bike/events?${params.toString()}`);
  return data.entries;
}

export async function createBikeCounterEvents(count: number, createdAt: string): Promise<BikeCounterStats> {
  const data = await apiFetch<{ stats: BikeCounterStats }>("/bike/events", {
    method: "POST",
    body: JSON.stringify({ action: "create", count, createdAt })
  });
  return data.stats;
}

export async function deleteBikeCounterEvents(ids: string[]): Promise<BikeCounterStats> {
  const data = await apiFetch<{ stats: BikeCounterStats }>("/bike/events", {
    method: "POST",
    body: JSON.stringify({ action: "delete", ids })
  });
  return data.stats;
}
