import { BaseType, CommandeStatus } from "../models/commande";

export function parseBaseType(value: unknown): BaseType {
  if (value === BaseType.CREME_FRAICHE || value === BaseType.TOMATE) {
    return value;
  }

  throw new Error("Invalid baseType");
}

export function parseStatus(value: unknown): CommandeStatus {
  if (
    value === CommandeStatus.A_FAIRE ||
    value === CommandeStatus.EN_COURS ||
    value === CommandeStatus.PRETE ||
    value === CommandeStatus.DELIVREE
  ) {
    return value;
  }

  throw new Error("Invalid status");
}

export function parseComment(value: unknown): string | undefined {
  if (value == null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("Invalid comment");
  }

  return value.trim();
}

export function parseCommandeNumber(value: unknown): number {
  const commandeNumber = Number(value);

  if (!Number.isInteger(commandeNumber) || commandeNumber < 1) {
    throw new Error("Invalid commande number");
  }

  return commandeNumber;
}
