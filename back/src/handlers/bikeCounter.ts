import { APIGatewayProxyHandler } from "aws-lambda";
import { jsonResponse } from "../services/http";
import { createBikeCounterEntry, getBikeCounterStats } from "../services/bikeRepository";

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    if (event.httpMethod === "POST" && (event.resource === "/bike/counter" || event.path.endsWith("/bike/counter"))) {
      const entry = await createBikeCounterEntry();
      return jsonResponse(201, { entry });
    }

    if (event.httpMethod === "GET" && (event.resource === "/bike/stats" || event.path.endsWith("/bike/stats"))) {
      const stats = await getBikeCounterStats();
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
