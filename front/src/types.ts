export type AppService =
  | "planning-public"
  | "planning-admin"
  | "bike-counter";

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
  activityDays?: BikeCounterHistoryBucket[];
}

export interface PlanningEditionSummary {
  editionId: string;
  title: string;
  startAt: string;
  endAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningBenevole {
  benevoleId: string;
  pseudo: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningCategorie {
  categorieId: string;
  title: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningAffectation {
  affectationId: string;
  benevoleId: string;
  categorieId: string;
  comment?: string;
  startAt: string;
  endAt: string;
  createdAt: string;
  updatedAt: string;
  benevole: PlanningBenevole;
  categorie: PlanningCategorie;
}

export interface PlanningEdition extends PlanningEditionSummary {
  benevoles: PlanningBenevole[];
  categories: PlanningCategorie[];
  affectations: PlanningAffectation[];
}
