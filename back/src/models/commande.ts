export const CommandeStatus = {
  A_FAIRE: "A_FAIRE",
  EN_COURS: "EN_COURS",
  PRETE: "PRETE",
  DELIVREE: "DELIVREE"
} as const;

export type CommandeStatus = (typeof CommandeStatus)[keyof typeof CommandeStatus];

export const BaseType = {
  CREME_FRAICHE: "CREME_FRAICHE",
  TOMATE: "TOMATE"
} as const;

export type BaseType = (typeof BaseType)[keyof typeof BaseType];

export interface Commande {
  commandeNumber: number;
  baseType: BaseType;
  comment?: string;
  status: CommandeStatus;
  createdAt: string;
  readyAt?: string;
  updatedAt: string;
}

export interface CreateCommandeInput {
  commandeNumber: number;
  baseType: BaseType;
  comment?: string;
}
