import { APIGatewayProxyResult } from "aws-lambda";

const defaultHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN ?? "*"
};

export function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify(body)
  };
}
