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

export type BikeHistoryRange = "10years" | "5years" | "2years" | "year" | "6months" | "month";
export type BikeHistoryBucketUnit = "year" | "month" | "day";

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
  activityDays: BikeCounterHistoryBucket[];
}
