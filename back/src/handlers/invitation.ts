import { APIGatewayProxyHandler } from "aws-lambda";
import { jsonResponse } from "../services/http";
import {
  inviteGuestToEdition,
  listInvitationGuestsWithStatuses,
  parseInvitationAttendanceStatus,
  parseInvitationContactStatus,
  uninviteGuestFromEdition,
  updateInvitationStatus
} from "../services/invitationRepository";
import { InvitationMembershipFilter } from "../services/invitationRepository";

function parseLimit(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseBody(body: string | null): Record<string, unknown> {
  if (!body) {
    return {};
  }

  return JSON.parse(body) as Record<string, unknown>;
}

function parseRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return value.trim();
}

function parseInvitationMembershipFilter(value?: string): InvitationMembershipFilter | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "all" || value === "invited" || value === "not_invited") {
    return value;
  }

  throw new Error("Invalid invitationFilter");
}

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    if (event.httpMethod === "GET" && (event.resource === "/invites" || event.path.endsWith("/invites"))) {
      const contactStatus = parseInvitationContactStatus(event.queryStringParameters?.contactStatus);
      const attendanceStatus = parseInvitationAttendanceStatus(event.queryStringParameters?.attendanceStatus);

      if (event.queryStringParameters?.contactStatus && !contactStatus) {
        return jsonResponse(400, { message: "Invalid contactStatus" });
      }

      if (event.queryStringParameters?.attendanceStatus && !attendanceStatus) {
        return jsonResponse(400, { message: "Invalid attendanceStatus" });
      }

      const guests = await listInvitationGuestsWithStatuses({
        editionId: event.queryStringParameters?.editionId,
        contactStatus,
        attendanceStatus,
        invitationFilter: parseInvitationMembershipFilter(event.queryStringParameters?.invitationFilter),
        invitedOnly: event.queryStringParameters?.invitedOnly === "true",
        limit: parseLimit(event.queryStringParameters?.limit),
        nextToken: event.queryStringParameters?.nextToken
      });
      return jsonResponse(200, guests);
    }

    if (event.httpMethod === "POST" && (event.resource === "/invites" || event.path.endsWith("/invites"))) {
      const body = parseBody(event.body ?? null);
      const action = body.action;
      const username = parseRequiredString(body.username, "username");
      const editionId = parseRequiredString(body.editionId, "editionId");

      if (action === "invite") {
        const status = await inviteGuestToEdition(username, editionId);
        return jsonResponse(200, { status });
      }

      if (action === "uninvite") {
        await uninviteGuestFromEdition(username, editionId);
        return jsonResponse(200, { ok: true });
      }

      if (action === "update-status") {
        const contactStatus = parseInvitationContactStatus(body.contactStatus);
        const attendanceStatus = parseInvitationAttendanceStatus(body.attendanceStatus);

        if (!contactStatus) {
          return jsonResponse(400, { message: "Invalid contactStatus" });
        }

        if (!attendanceStatus) {
          return jsonResponse(400, { message: "Invalid attendanceStatus" });
        }

        const status = await updateInvitationStatus({
          username,
          editionId,
          contactStatus,
          attendanceStatus
        });
        return jsonResponse(200, { status });
      }

      return jsonResponse(400, { message: "Invalid action" });
    }

    return jsonResponse(405, { message: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const statusCode = message.startsWith("Invalid")
      ? 400
      : message.includes("ConditionalCheckFailed")
        ? 404
        : 500;

    return jsonResponse(statusCode, {
      message: "Unable to process invitation request",
      error: message
    });
  }
};
