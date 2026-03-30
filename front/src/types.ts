export type CommandeStatus = "A_FAIRE" | "EN_COURS" | "PRETE" | "DELIVREE";
export type BaseType = "CREME_FRAICHE" | "TOMATE";

export interface Commande {
  commandeNumber: number;
  baseType: BaseType;
  comment?: string;
  status: CommandeStatus;
  createdAt: string;
  readyAt?: string;
  updatedAt: string;
}
