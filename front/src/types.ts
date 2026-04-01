export type CommandeStatus = "A_FAIRE" | "EN_COURS" | "PRETE" | "DELIVREE";
export type BaseType = "CREME_FRAICHE" | "TOMATE";
export type AppService = "food-commande" | "food-cuisine" | "bike-counter";

export interface Commande {
  commandeNumber: number;
  baseType: BaseType;
  comment?: string;
  status: CommandeStatus;
  createdAt: string;
  readyAt?: string;
  updatedAt: string;
}

export interface BikeCounterStats {
  totalCount: number;
  sessionCount: number;
}

export type BikeHistoryRange = "year" | "6months" | "3months" | "month" | "week" | "day";
export type BikeHistoryBucketUnit = "month" | "week" | "day" | "hour";

export interface BikeCounterHistoryBucket {
  startAt: string;
  endAt: string;
  count: number;
}

export interface BikeCounterHistory {
  range: BikeHistoryRange;
  bucketUnit: BikeHistoryBucketUnit;
  from: string;
  to: string;
  totalCount: number;
  peakCount: number;
  buckets: BikeCounterHistoryBucket[];
}
