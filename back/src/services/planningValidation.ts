export function parsePlanningTitle(value: unknown, fieldName = "title"): string {
  if (typeof value !== "string") {
    throw new Error(fieldName === "pseudo" ? "Pseudo invalide" : "Titre invalide");
  }

  const normalized = value.trim();

  if (normalized.length < 2 || normalized.length > 80) {
    throw new Error(fieldName === "pseudo" ? "Pseudo invalide" : "Titre invalide");
  }

  return normalized;
}

export function parsePlanningPhone(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Telephone invalide");
  }

  const normalized = value.trim();

  if (normalized.length < 4 || normalized.length > 40) {
    throw new Error("Telephone invalide");
  }

  return normalized;
}

export function parsePlanningColor(value: unknown): string {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    throw new Error("Couleur invalide");
  }

  return value.trim().toUpperCase();
}

export function parsePlanningComment(value: unknown): string | undefined {
  if (value == null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("Commentaire invalide");
  }

  const normalized = value.trim();

  if (normalized.length > 240) {
    throw new Error("Commentaire invalide");
  }

  return normalized || undefined;
}

export function parsePlanningEntityId(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} invalide`);
  }

  const normalized = value.trim();

  if (!normalized || normalized.length > 80) {
    throw new Error(`${fieldName} invalide`);
  }

  return normalized;
}

function parseDateInternal(value: unknown, fieldName: string): Date {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} invalide`);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} invalide`);
  }

  return parsed;
}

export function parsePlanningDateTime(value: unknown, fieldName: string): string {
  const parsed = parseDateInternal(value, fieldName);
  const minutes = parsed.getUTCMinutes();

  if (minutes !== 0 && minutes !== 30) {
    throw new Error(`${fieldName} invalide`);
  }

  if (parsed.getUTCSeconds() !== 0 || parsed.getUTCMilliseconds() !== 0) {
    throw new Error(`${fieldName} invalide`);
  }

  return parsed.toISOString();
}

export function assertPlanningDateRange(startAt: string, endAt: string): void {
  if (Date.parse(endAt) <= Date.parse(startAt)) {
    throw new Error("Plage horaire invalide");
  }
}
