import { APIGatewayProxyHandler } from "aws-lambda";
import { BikeHistoryRange } from "../models/bikeCounter";
import { jsonResponse } from "../services/http";
import {
  getBikeCounterHistory,
  getBikeCounterStats,
  recordBikeCounterEntries,
  resetBikeSessionStats
} from "../services/bikeRepository";

const HISTORY_RANGES: BikeHistoryRange[] = ["year", "6months", "3months", "month", "week", "day"];

function parseRequestedCount(body: string | null): number | null {
  if (!body) {
    return null;
  }

  const trimmedBody = body.trim();
  if (trimmedBody.length === 0) {
    return null;
  }

  const parsedInteger = Number(trimmedBody);
  if (Number.isInteger(parsedInteger) && parsedInteger > 0) {
    return parsedInteger;
  }

  try {
    const parsedJson = JSON.parse(trimmedBody) as { count?: unknown };
    if (Number.isInteger(parsedJson.count) && (parsedJson.count as number) > 0) {
      return parsedJson.count as number;
    }
  } catch {
    return null;
  }

  return null;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    if (event.httpMethod === "POST" && (event.resource === "/bike/counter" || event.path.endsWith("/bike/counter"))) {
      const requestedCount = parseRequestedCount(event.body ?? null);

      if (!requestedCount) {
        return jsonResponse(400, {
          message: "A positive integer count is required in the request body"
        });
      }

      const result = await recordBikeCounterEntries(requestedCount);
      return jsonResponse(201, {
        createdCount: result.entries.length,
        createdAt: result.entries[0]?.createdAt ?? null,
        stats: result.stats
      });
    }

    if (event.httpMethod === "GET" && (event.resource === "/bike/stats" || event.path.endsWith("/bike/stats"))) {
      const stats = await getBikeCounterStats();
      return jsonResponse(200, { stats });
    }

    if (event.httpMethod === "GET" && (event.resource === "/bike/history" || event.path.endsWith("/bike/history"))) {
      const requestedRange = event.queryStringParameters?.range;
      const range = HISTORY_RANGES.includes(requestedRange as BikeHistoryRange)
        ? (requestedRange as BikeHistoryRange)
        : "month";

      const history = await getBikeCounterHistory(range);
      return jsonResponse(200, { history });
    }

    if (event.httpMethod === "POST" && (event.resource === "/bike/resetsession" || event.path.endsWith("/bike/resetsession"))) {
      const stats = await resetBikeSessionStats();
      return jsonResponse(200, { stats });
    }

    return jsonResponse(405, { message: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return jsonResponse(500, {
      message: "Unable to process bike counter request",
      error: message
    });
  }
};
