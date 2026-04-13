import {
  AppService,
  BaseType,
  BikeCounterHistory,
  BikeHistoryRange,
  BikeCounterStats,
  Commande,
  CommandeStatus,
  PlanningAffectation,
  PlanningBenevole,
  PlanningCategorie,
  PlanningEdition,
  PlanningEditionSummary
} from "./types";

const storageKey = "dervenn-basic-auth";
const serviceKey = "dervenn-service";
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
  return configured || runtimeApiBaseUrl;
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
  return value === "food-commande" ||
    value === "food-cuisine" ||
    value === "planning-public" ||
    value === "planning-admin" ||
    value === "bike-counter"
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

export async function getCommandes(): Promise<Commande[]> {
  const data = await apiFetch<{ commandes: Commande[] }>("/commandes");
  return data.commandes;
}

export async function addCommande(
  commandeNumber: number,
  baseType: BaseType,
  comment?: string
): Promise<Commande> {
  const data = await apiFetch<{ commande: Commande }>("/commandes", {
    method: "POST",
    body: JSON.stringify({ action: "create", commandeNumber, baseType, comment })
  });
  return data.commande;
}

export async function updateCommandeStatus(
  commandeNumber: number,
  status: CommandeStatus
): Promise<Commande> {
  const data = await apiFetch<{ commande: Commande }>(`/commandes?action=update-status`, {
    method: "POST",
    body: JSON.stringify({ action: "update-status", commandeNumber, status })
  });
  return data.commande;
}

export async function deleteCommande(commandeNumber: number): Promise<Commande> {
  const data = await apiFetch<{ commande: Commande }>(`/commandes?action=delete`, {
    method: "POST",
    body: JSON.stringify({ action: "delete", commandeNumber })
  });
  return data.commande;
}

export async function getBikeCounterStats(): Promise<BikeCounterStats> {
  const data = await apiFetch<{ stats: BikeCounterStats }>("/bike/stats");
  return data.stats;
}

export async function getBikeCounterHistory(range: BikeHistoryRange): Promise<BikeCounterHistory> {
  const data = await apiFetch<{ history: BikeCounterHistory }>(`/bike/history?range=${encodeURIComponent(range)}`);
  return data.history;
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
