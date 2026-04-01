export interface BikeCounterEntry {
  id: string;
  createdAt: string;
}

export interface BikeCounterStatsDocument {
  id: string;
  total: number;
  session: number;
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
