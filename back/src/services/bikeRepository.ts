import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import {
  BikeCounterEntry,
  BikeCounterHistory,
  BikeCounterHistoryBucket,
  BikeCounterStats,
  BikeCounterStatsDocument,
  BikeHistoryBucketUnit,
  BikeHistoryRange
} from "../models/bikeCounter";

const EVENTS_TABLE_NAME = process.env.BIKE_EVENTS_TABLE_NAME;
const STATS_TABLE_NAME = process.env.BIKE_STATS_TABLE_NAME;

if (!EVENTS_TABLE_NAME || !STATS_TABLE_NAME) {
  throw new Error("BIKE_EVENTS_TABLE_NAME and BIKE_STATS_TABLE_NAME environment variables are required");
}

const eventsTableName: string = EVENTS_TABLE_NAME;
const statsTableName: string = STATS_TABLE_NAME;

const client = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(client);

const STATS_DOCUMENT_ID = "stats";
const BATCH_WRITE_LIMIT = 25;

function createCounterId(createdAt: string): string {
  return `${createdAt}#${randomUUID()}`;
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function mapStatsDocumentToStats(statsDocument?: Partial<BikeCounterStatsDocument>): BikeCounterStats {
  return {
    totalCount: typeof statsDocument?.total === "number" ? statsDocument.total : 0,
    sessionCount: typeof statsDocument?.session === "number" ? statsDocument.session : 0
  };
}

function startOfUtcHour(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    0,
    0,
    0
  ));
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function addUtcHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 0, 0, 0, 0));
}

function createSequentialBuckets(
  start: Date,
  bucketCount: number,
  bucketUnit: BikeHistoryBucketUnit,
  now: Date
): BikeCounterHistoryBucket[] {
  const buckets: BikeCounterHistoryBucket[] = [];

  for (let index = 0; index < bucketCount; index++) {
    const bucketStart = index === 0
      ? new Date(start)
      : new Date(buckets[index - 1].endAt);

    const bucketEnd = index === bucketCount - 1
      ? new Date(now)
      : bucketUnit === "hour"
        ? addUtcHours(bucketStart, 1)
        : bucketUnit === "day"
          ? addUtcDays(bucketStart, 1)
          : bucketUnit === "week"
            ? addUtcDays(bucketStart, 7)
            : addUtcMonths(bucketStart, 1);

    buckets.push({
      startAt: bucketStart.toISOString(),
      endAt: bucketEnd.toISOString(),
      count: 0
    });
  }

  return buckets;
}

function buildHistoryBuckets(range: BikeHistoryRange, now: Date): BikeCounterHistoryBucket[] {
  if (range === "day") {
    return createSequentialBuckets(addUtcHours(startOfUtcHour(now), -23), 24, "hour", now);
  }

  if (range === "week") {
    return createSequentialBuckets(addUtcDays(startOfUtcDay(now), -6), 7, "day", now);
  }

  if (range === "month") {
    return createSequentialBuckets(addUtcDays(startOfUtcDay(now), -29), 30, "day", now);
  }

  if (range === "3months") {
    return createSequentialBuckets(addUtcDays(startOfUtcDay(now), -84), 13, "week", now);
  }

  if (range === "6months") {
    return createSequentialBuckets(addUtcMonths(startOfUtcMonth(now), -5), 6, "month", now);
  }

  return createSequentialBuckets(addUtcMonths(startOfUtcMonth(now), -11), 12, "month", now);
}

function getBucketUnit(range: BikeHistoryRange): BikeHistoryBucketUnit {
  if (range === "day") {
    return "hour";
  }

  if (range === "week" || range === "month") {
    return "day";
  }

  if (range === "3months") {
    return "week";
  }

  return "month";
}

function incrementMatchingBucket(buckets: BikeCounterHistoryBucket[], createdAt: string): void {
  const createdAtTime = Date.parse(createdAt);

  if (Number.isNaN(createdAtTime)) {
    return;
  }

  for (let index = 0; index < buckets.length; index++) {
    const bucket = buckets[index];
    const bucketStart = Date.parse(bucket.startAt);
    const bucketEnd = Date.parse(bucket.endAt);
    const isLastBucket = index === buckets.length - 1;

    if (createdAtTime < bucketStart) {
      continue;
    }

    if (createdAtTime < bucketEnd || (isLastBucket && createdAtTime <= bucketEnd)) {
      bucket.count += 1;
      return;
    }
  }
}

async function createBikeCounterEntries(count: number): Promise<BikeCounterEntry[]> {
  const createdAt = new Date().toISOString();
  const entries = Array.from({ length: count }, () => ({
    id: createCounterId(createdAt),
    createdAt
  }));

  for (const batch of chunkArray(entries, BATCH_WRITE_LIMIT)) {
    await documentClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [eventsTableName]: batch.map((entry) => ({
            PutRequest: {
              Item: entry
            }
          }))
        }
      })
    );
  }

  return entries;
}

async function incrementBikeCounterStats(count: number): Promise<BikeCounterStats> {
  const updatedAt = new Date().toISOString();

  const response = await documentClient.send(
    new UpdateCommand({
      TableName: statsTableName,
      Key: { id: STATS_DOCUMENT_ID },
      UpdateExpression: "SET updatedAt = :updatedAt ADD #total :count, #session :count",
      ExpressionAttributeNames: {
        "#total": "total",
        "#session": "session"
      },
      ExpressionAttributeValues: {
        ":updatedAt": updatedAt,
        ":count": count
      },
      ReturnValues: "ALL_NEW"
    })
  );

  return mapStatsDocumentToStats(response.Attributes as Partial<BikeCounterStatsDocument> | undefined);
}

export async function recordBikeCounterEntries(count: number): Promise<{ entries: BikeCounterEntry[]; stats: BikeCounterStats }> {
  const entries = await createBikeCounterEntries(count);
  const stats = await incrementBikeCounterStats(count);

  return { entries, stats };
}

export async function getBikeCounterStats(): Promise<BikeCounterStats> {
  const response = await documentClient.send(
    new GetCommand({
      TableName: statsTableName,
      Key: { id: STATS_DOCUMENT_ID }
    })
  );

  return mapStatsDocumentToStats(response.Item as Partial<BikeCounterStatsDocument> | undefined);
}

export async function getBikeCounterHistory(range: BikeHistoryRange): Promise<BikeCounterHistory> {
  const now = new Date();
  const buckets = buildHistoryBuckets(range, now);
  const firstBucket = buckets[0];
  const lastBucket = buckets[buckets.length - 1];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await documentClient.send(
      new ScanCommand({
        TableName: eventsTableName,
        ProjectionExpression: "#createdAt",
        FilterExpression: "#createdAt BETWEEN :from AND :to",
        ExpressionAttributeNames: {
          "#createdAt": "createdAt"
        },
        ExpressionAttributeValues: {
          ":from": firstBucket.startAt,
          ":to": lastBucket.endAt
        },
        ExclusiveStartKey: exclusiveStartKey
      })
    );

    for (const item of response.Items ?? []) {
      if (typeof item.createdAt === "string") {
        incrementMatchingBucket(buckets, item.createdAt);
      }
    }

    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  return {
    range,
    bucketUnit: getBucketUnit(range),
    from: firstBucket.startAt,
    to: lastBucket.endAt,
    totalCount: buckets.reduce((sum, bucket) => sum + bucket.count, 0),
    peakCount: buckets.reduce((peak, bucket) => Math.max(peak, bucket.count), 0),
    buckets
  };
}

export async function resetBikeSessionStats(): Promise<BikeCounterStats> {
  const updatedAt = new Date().toISOString();

  const response = await documentClient.send(
    new UpdateCommand({
      TableName: statsTableName,
      Key: { id: STATS_DOCUMENT_ID },
      UpdateExpression: "SET updatedAt = :updatedAt, #session = :zero",
      ExpressionAttributeNames: {
        "#session": "session"
      },
      ExpressionAttributeValues: {
        ":updatedAt": updatedAt,
        ":zero": 0
      },
      ReturnValues: "ALL_NEW"
    })
  );

  return mapStatsDocumentToStats(response.Attributes as Partial<BikeCounterStatsDocument> | undefined);
}
