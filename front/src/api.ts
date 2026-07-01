import {
  AppService,
  BikeCounterEntry,
  BikeCounterHistory,
  BikeHistoryRange,
  BikeCounterStats,
  InvitationAttendanceStatus,
  InvitationContactStatus,
  InvitationGuest,
  InvitationGuestFilters,
  PaginatedInvitationGuests,
  PlanningAffectation,
  PlanningBenevole,
  PlanningCategorie,
  PlanningEdition,
  PlanningEditionSummary
} from "./types";

const storageKey = "dervenn-basic-auth";
const serviceKey = "dervenn-service";
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
  window.sessionStorage.removeItem(serviceKey);
}

export function hasCredentials(): boolean {
  return Boolean(window.sessionStorage.getItem(storageKey));
}

export function saveSelectedService(service: AppService): void {
  window.sessionStorage.setItem(serviceKey, service);
}

export function getSelectedService(): AppService | null {
  const value = window.sessionStorage.getItem(serviceKey);
  return value === "planning-public" ||
    value === "planning-admin" ||
    value === "bike-counter" ||
    value === "invitation-guests"
    ? value
    : null;
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

export async function getInvitationGuests(filters: InvitationGuestFilters = {}): Promise<PaginatedInvitationGuests> {
  const params = new URLSearchParams();

  if (filters.editionId) {
    params.set("editionId", filters.editionId);
  }

  if (filters.contactStatus) {
    params.set("contactStatus", filters.contactStatus);
  }

  if (filters.attendanceStatus) {
    params.set("attendanceStatus", filters.attendanceStatus);
  }

  if (filters.invitationFilter) {
    params.set("invitationFilter", filters.invitationFilter);
  }

  if (filters.invitedOnly) {
    params.set("invitedOnly", "true");
  }

  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }

  if (filters.nextToken) {
    params.set("nextToken", filters.nextToken);
  }

  const queryString = params.toString();
  return apiFetch<PaginatedInvitationGuests>(`/invites${queryString ? `?${queryString}` : ""}`);
}

export async function inviteGuestToEdition(username: string, editionId: string): Promise<void> {
  await apiFetch<{ status: unknown }>("/invites", {
    method: "POST",
    body: JSON.stringify({ action: "invite", username, editionId })
  });
}

export async function uninviteGuestFromEdition(username: string, editionId: string): Promise<void> {
  await apiFetch<void>("/invites", {
    method: "POST",
    body: JSON.stringify({ action: "uninvite", username, editionId })
  });
}

export async function updateInvitationGuestStatus(
  username: string,
  editionId: string,
  contactStatus: InvitationContactStatus,
  attendanceStatus: InvitationAttendanceStatus
): Promise<void> {
  await apiFetch<{ status: unknown }>("/invites", {
    method: "POST",
    body: JSON.stringify({
      action: "update-status",
      username,
      editionId,
      contactStatus,
      attendanceStatus
    })
  });
}

function getPlanningBasePath(adminMode: boolean): string {
  return adminMode ? "/planning/admin" : "/planning";
}

export async function getPlanningEditions(adminMode: boolean): Promise<PlanningEditionSummary[]> {
  const data = await apiFetch<{ editions: PlanningEditionSummary[] }>(`${getPlanningBasePath(adminMode)}/editions`);
  return data.editions;
}

export async function getPlanningEdition(editionId: string, adminMode: boolean): Promise<PlanningEdition> {
  const data = await apiFetch<{ edition: PlanningEdition }>(
    `${getPlanningBasePath(adminMode)}/editions/${encodeURIComponent(editionId)}`
  );
  return data.edition;
}

export async function createPlanningEdition(
  title: string,
  startAt: string,
  endAt: string
): Promise<PlanningEditionSummary> {
  const data = await apiFetch<{ edition: PlanningEditionSummary }>("/planning/admin/editions", {
    method: "POST",
    body: JSON.stringify({ title, startAt, endAt })
  });
  return data.edition;
}

export async function updatePlanningEdition(
  editionId: string,
  title: string,
  startAt: string,
  endAt: string
): Promise<PlanningEditionSummary> {
  const data = await apiFetch<{ edition: PlanningEditionSummary }>(
    `/planning/admin/editions/${encodeURIComponent(editionId)}`,
    {
      method: "POST",
      body: JSON.stringify({ action: "update-edition", title, startAt, endAt })
    }
  );
  return data.edition;
}

export async function createPlanningBenevole(
  editionId: string,
  pseudo: string,
  phone: string
): Promise<PlanningBenevole> {
  const data = await apiFetch<{ benevole: PlanningBenevole }>(
    `/planning/admin/editions/${encodeURIComponent(editionId)}`,
    {
      method: "POST",
      body: JSON.stringify({ action: "create-benevole", pseudo, phone })
    }
  );
  return data.benevole;
}

export async function updatePlanningBenevole(
  editionId: string,
  benevoleId: string,
  pseudo: string,
  phone: string
): Promise<PlanningBenevole> {
  const data = await apiFetch<{ benevole: PlanningBenevole }>(
    `/planning/admin/editions/${encodeURIComponent(editionId)}`,
    {
      method: "POST",
      body: JSON.stringify({ action: "update-benevole", benevoleId, pseudo, phone })
    }
  );
  return data.benevole;
}

export async function createPlanningCategorie(
  editionId: string,
  title: string,
  color: string
): Promise<PlanningCategorie> {
  const data = await apiFetch<{ categorie: PlanningCategorie }>(
    `/planning/admin/editions/${encodeURIComponent(editionId)}`,
    {
      method: "POST",
      body: JSON.stringify({ action: "create-categorie", title, color })
    }
  );
  return data.categorie;
}

export async function updatePlanningCategorie(
  editionId: string,
  categorieId: string,
  title: string,
  color: string
): Promise<PlanningCategorie> {
  const data = await apiFetch<{ categorie: PlanningCategorie }>(
    `/planning/admin/editions/${encodeURIComponent(editionId)}`,
    {
      method: "POST",
      body: JSON.stringify({ action: "update-categorie", categorieId, title, color })
    }
  );
  return data.categorie;
}

export async function createPlanningAffectation(
  editionId: string,
  benevoleId: string,
  categorieId: string,
  startAt: string,
  endAt: string,
  comment?: string
): Promise<PlanningAffectation> {
  const data = await apiFetch<{ affectation: PlanningAffectation }>(
    `/planning/admin/editions/${encodeURIComponent(editionId)}`,
    {
      method: "POST",
      body: JSON.stringify({ action: "create-affectation", benevoleId, categorieId, startAt, endAt, comment })
    }
  );
  return data.affectation;
}

export async function deletePlanningAffectation(
  editionId: string,
  affectationId: string
): Promise<void> {
  await apiFetch<{ affectation: PlanningAffectation }>(`/planning/admin/editions/${encodeURIComponent(editionId)}`, {
    method: "POST",
    body: JSON.stringify({ action: "delete-affectation", affectationId })
  });
}
