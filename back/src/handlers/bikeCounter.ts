import { APIGatewayProxyHandler } from "aws-lambda";
import { BikeHistoryRange } from "../models/bikeCounter";
import { jsonResponse } from "../services/http";
import {
  createBikeCounterEntriesForAdmin,
  deleteBikeCounterEntriesForAdmin,
  getBikeCounterHistory,
  getBikeCounterStats,
  listBikeCounterEntries,
  recordBikeCounterEntries,
  recalculateBikeCounterStats,
  resetBikeSessionStats
} from "../services/bikeRepository";

const HISTORY_RANGES: BikeHistoryRange[] = ["10years", "5years", "2years", "year", "6months", "month"];
const MAX_ADMIN_CREATE_COUNT = 1000;
const MAX_ADMIN_DELETE_COUNT = 1000;
const MAX_ADMIN_LIST_LIMIT = 500;

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

function isBikeEventsRoute(event: Parameters<APIGatewayProxyHandler>[0]): boolean {
  return event.resource === "/bike/events" || event.path.endsWith("/bike/events");
}

function parseIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function parsePositiveInteger(value: unknown, max: number): number | null {
  if (!Number.isInteger(value) || (value as number) <= 0 || (value as number) > max) {
    return null;
  }

  return value as number;
}

function parseAdminEventsBody(body: string | null): Record<string, unknown> | null {
  if (!body) {
    return null;
  }

  try {
    const parsed = JSON.parse(body) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
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

    if (event.httpMethod === "POST" && (event.resource === "/bike/stats" || event.path.endsWith("/bike/stats"))) {
      const stats = await recalculateBikeCounterStats();
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

    if (event.httpMethod === "GET" && isBikeEventsRoute(event)) {
      const now = new Date();
      const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const from = parseIsoDate(event.queryStringParameters?.from) ?? defaultFrom;
      const to = parseIsoDate(event.queryStringParameters?.to) ?? now.toISOString();
      const requestedLimit = Number(event.queryStringParameters?.limit ?? 100);
      const limit = Number.isInteger(requestedLimit)
        ? Math.min(Math.max(requestedLimit, 1), MAX_ADMIN_LIST_LIMIT)
        : 100;

      if (Date.parse(from) > Date.parse(to)) {
        return jsonResponse(400, { message: "The from date must be before the to date" });
      }

      const entries = await listBikeCounterEntries(from, to, limit);
      return jsonResponse(200, { entries });
    }

    if (event.httpMethod === "POST" && isBikeEventsRoute(event)) {
      const body = parseAdminEventsBody(event.body ?? null);

      if (!body) {
        return jsonResponse(400, { message: "A JSON request body is required" });
      }

      const action = body?.action;

      if (action === "create") {
        const count = parsePositiveInteger(body.count, MAX_ADMIN_CREATE_COUNT);
        const createdAt = parseIsoDate(body.createdAt);

        if (!count || !createdAt) {
          return jsonResponse(400, {
            message: `A count between 1 and ${MAX_ADMIN_CREATE_COUNT} and a valid createdAt date are required`
          });
        }

        const result = await createBikeCounterEntriesForAdmin(count, createdAt);
        return jsonResponse(201, {
          createdCount: result.entries.length,
          entries: result.entries,
          stats: result.stats
        });
      }

      if (action === "delete") {
        const ids = Array.isArray(body.ids)
          ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0)
          : [];
        const uniqueIds = Array.from(new Set(ids)).slice(0, MAX_ADMIN_DELETE_COUNT);

        if (uniqueIds.length === 0) {
          return jsonResponse(400, { message: "At least one event id is required" });
        }

        const result = await deleteBikeCounterEntriesForAdmin(uniqueIds);
        return jsonResponse(200, result);
      }

      return jsonResponse(400, { message: "Unsupported bike event action" });
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
