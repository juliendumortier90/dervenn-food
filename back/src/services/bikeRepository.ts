import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { BikeCounterEntry, BikeCounterStats } from "../models/bikeCounter";

const TABLE_NAME = process.env.BIKE_TABLE_NAME;

if (!TABLE_NAME) {
  throw new Error("BIKE_TABLE_NAME environment variable is required");
}

const client = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(client);

const COUNTER_PK = "COUNTER";

function createCounterId(createdAt: string): string {
  return `${createdAt}#${randomUUID()}`;
}

export async function createBikeCounterEntry(): Promise<BikeCounterEntry> {
  const createdAt = new Date().toISOString();
  const id = createCounterId(createdAt);
  const entry: BikeCounterEntry = {
    id,
    createdAt
  };

  await documentClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: COUNTER_PK,
        sk: id,
        entityType: "BIKE_COUNTER_ENTRY",
        ...entry
      },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)"
    })
  );

  return entry;
}

export async function getBikeCounterStats(): Promise<BikeCounterStats> {
  let totalCount = 0;
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await documentClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": COUNTER_PK
        },
        Select: "COUNT",
        ExclusiveStartKey: exclusiveStartKey
      })
    );

    totalCount += response.Count ?? 0;
    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  return {
    totalCount
  };
}
