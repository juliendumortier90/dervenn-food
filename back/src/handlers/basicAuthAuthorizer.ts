import {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEvent,
  APIGatewayRequestAuthorizerHandler
} from "aws-lambda";

const expectedUsername = process.env.BASIC_AUTH_USERNAME;
const expectedFoodPassword = process.env.FOOD_BASIC_AUTH_PASSWORD;
const expectedBikePassword = process.env.BIKE_BASIC_AUTH_PASSWORD;

if (!expectedUsername || !expectedFoodPassword || !expectedBikePassword) {
  throw new Error(
    "Missing BASIC_AUTH_USERNAME, FOOD_BASIC_AUTH_PASSWORD or BIKE_BASIC_AUTH_PASSWORD"
  );
}

function generatePolicy(principalId: string, effect: "Allow" | "Deny", resource: string): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource
        }
      ]
    },
    context: {
      username: principalId
    }
  };
}

function decodeAuthorizationHeader(headerValue?: string): { username: string; password: string } | null {
  if (!headerValue || !headerValue.startsWith("Basic ")) {
    return null;
  }

  const base64Credentials = headerValue.replace("Basic ", "");
  const decoded = Buffer.from(base64Credentials, "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");

  if (separatorIndex < 0) {
    return null;
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1)
  };
}

function extractPath(event: APIGatewayRequestAuthorizerEvent): string {
  if (event.path) {
    return event.path;
  }

  const arnParts = event.methodArn.split("/");
  const resourcePath = arnParts.slice(3).join("/");

  return resourcePath ? `/${resourcePath}` : "/";
}

function expectedPasswordForPath(path: string): string | null {
  if (path.startsWith("/bike")) {
    return expectedBikePassword ?? null;
  }

  if (path.startsWith("/commandes")) {
    return expectedFoodPassword ?? null;
  }

  return null;
}

export const handler: APIGatewayRequestAuthorizerHandler = async (
  event: APIGatewayRequestAuthorizerEvent
) => {
  const credentials = decodeAuthorizationHeader(event.headers?.Authorization ?? event.headers?.authorization);
  const expectedPassword = expectedPasswordForPath(extractPath(event));

  if (
    credentials &&
    expectedPassword &&
    credentials.username === expectedUsername &&
    credentials.password === expectedPassword
  ) {
    return generatePolicy(credentials.username, "Allow", event.methodArn);
  }

  return generatePolicy("anonymous", "Deny", event.methodArn);
};
