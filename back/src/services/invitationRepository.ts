import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchGetCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import {
  InvitationAttendanceStatus,
  InvitationContactStatus,
  InvitationGuest,
  InvitationGuestWithStatus,
  InvitationStatus,
  PaginatedInvitationGuests
} from "../models/invitation";

const GUESTS_TABLE_NAME = process.env.INVITATION_GUESTS_TABLE_NAME;
const STATUSES_TABLE_NAME = process.env.INVITATION_STATUSES_TABLE_NAME;
const EDITION_INDEX_NAME = "editionId-index";
const DEFAULT_CONTACT_STATUS: InvitationContactStatus = "non_contacte";
const DEFAULT_ATTENDANCE_STATUS: InvitationAttendanceStatus = "pas_repondu";
const DEFAULT_PAGE_LIMIT = 100;
const MAX_PAGE_LIMIT = 100;
export type InvitationMembershipFilter = "all" | "invited" | "not_invited";

if (!GUESTS_TABLE_NAME || !STATUSES_TABLE_NAME) {
  throw new Error("INVITATION_GUESTS_TABLE_NAME and INVITATION_STATUSES_TABLE_NAME environment variables are required");
}

const client = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(client);

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function toInvitationGuest(item: Record<string, unknown>): InvitationGuest {
  return {
    username: String(item.username),
    fullName: String(item.fullName),
    profilePictureBase64: optionalString(item.profilePictureBase64),
    createdAt: optionalString(item.createdAt),
    updatedAt: optionalString(item.updatedAt)
  };
}

function encodeNextToken(lastEvaluatedKey?: Record<string, unknown>): string | undefined {
  if (!lastEvaluatedKey) {
    return undefined;
  }

  return Buffer.from(JSON.stringify(lastEvaluatedKey), "utf8").toString("base64url");
}

function decodeNextToken(nextToken?: string): Record<string, unknown> | undefined {
  if (!nextToken) {
    return undefined;
  }

  const decoded = Buffer.from(nextToken, "base64url").toString("utf8");
  const parsed = JSON.parse(decoded) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid nextToken");
  }

  return parsed as Record<string, unknown>;
}

function normalizeLimit(limit?: number): number {
  if (!limit || !Number.isInteger(limit) || limit < 1) {
    return DEFAULT_PAGE_LIMIT;
  }

  return Math.min(limit, MAX_PAGE_LIMIT);
}

function isInvitationContactStatus(value: unknown): value is InvitationContactStatus {
  return value === "non_contacte" || value === "premier_contact" || value === "contacte";
}

function isInvitationAttendanceStatus(value: unknown): value is InvitationAttendanceStatus {
  return value === "pas_repondu" || value === "pas_encore_sur" || value === "present" || value === "absent";
}

function toInvitationStatus(item: Record<string, unknown>): InvitationStatus {
  const contactStatus = isInvitationContactStatus(item.contactStatus)
    ? item.contactStatus
    : DEFAULT_CONTACT_STATUS;
  const attendanceStatus = isInvitationAttendanceStatus(item.attendanceStatus)
    ? item.attendanceStatus
    : DEFAULT_ATTENDANCE_STATUS;

  return {
    invitationId: String(item.invitationId),
    username: String(item.username),
    editionId: String(item.editionId),
    contactStatus,
    attendanceStatus,
    createdAt: optionalString(item.createdAt),
    updatedAt: optionalString(item.updatedAt)
  };
}

export async function listInvitationGuests(): Promise<InvitationGuest[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await documentClient.send(
      new ScanCommand({
        TableName: GUESTS_TABLE_NAME,
        ExclusiveStartKey: exclusiveStartKey
      })
    );

    items.push(...((response.Items ?? []) as Record<string, unknown>[]));
    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  return items
    .map(toInvitationGuest)
    .sort((left, right) => left.fullName.localeCompare(right.fullName, "fr-FR"));
}

async function listInvitationGuestsPage(input: {
  limit?: number;
  nextToken?: string;
}): Promise<{ guests: InvitationGuest[]; nextToken?: string }> {
  const response = await documentClient.send(
    new ScanCommand({
      TableName: GUESTS_TABLE_NAME,
      ExclusiveStartKey: decodeNextToken(input.nextToken),
      Limit: normalizeLimit(input.limit)
    })
  );

  return {
    guests: ((response.Items ?? []) as Record<string, unknown>[])
      .map(toInvitationGuest)
      .sort((left, right) => left.fullName.localeCompare(right.fullName, "fr-FR")),
    nextToken: encodeNextToken(response.LastEvaluatedKey as Record<string, unknown> | undefined)
  };
}

async function listInvitationStatusesByEdition(editionId: string): Promise<InvitationStatus[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await documentClient.send(
      new QueryCommand({
        TableName: STATUSES_TABLE_NAME,
        IndexName: EDITION_INDEX_NAME,
        KeyConditionExpression: "editionId = :editionId",
        ExpressionAttributeValues: {
          ":editionId": editionId
        },
        ExclusiveStartKey: exclusiveStartKey
      })
    );

    items.push(...((response.Items ?? []) as Record<string, unknown>[]));
    exclusiveStartKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);

  return items.map(toInvitationStatus);
}

export async function listInvitationGuestsWithStatuses(input: {
  attendanceStatus?: InvitationAttendanceStatus;
  contactStatus?: InvitationContactStatus;
  editionId?: string;
  invitationFilter?: InvitationMembershipFilter;
  invitedOnly?: boolean;
  limit?: number;
  nextToken?: string;
}): Promise<PaginatedInvitationGuests> {
  if ((input.invitedOnly || input.invitationFilter === "invited") && input.editionId) {
    return listInvitedGuestsByEdition(input as {
      attendanceStatus?: InvitationAttendanceStatus;
      contactStatus?: InvitationContactStatus;
      editionId: string;
      limit?: number;
      nextToken?: string;
    });
  }

  const guestsPage = await listInvitationGuestsPage({
    limit: input.limit,
    nextToken: input.nextToken
  });

  if (!input.editionId) {
    return {
      guests: guestsPage.guests.map((guest) => ({
        ...guest,
        contactStatus: DEFAULT_CONTACT_STATUS,
        attendanceStatus: DEFAULT_ATTENDANCE_STATUS
      })),
      nextToken: guestsPage.nextToken
    };
  }

  const statuses = await listInvitationStatusesByEdition(input.editionId);
  const statusesByUsername = new Map(statuses.map((status) => [status.username, status]));

  const guests = guestsPage.guests
    .map((guest): InvitationGuestWithStatus => {
      const status = statusesByUsername.get(guest.username);

      return {
        ...guest,
        editionId: input.editionId,
        contactStatus: status?.contactStatus ?? DEFAULT_CONTACT_STATUS,
        attendanceStatus: status?.attendanceStatus ?? DEFAULT_ATTENDANCE_STATUS,
        isInvited: Boolean(status),
        statusUpdatedAt: status?.updatedAt
      };
    })
    .filter((guest) => input.invitationFilter !== "not_invited" || !guest.isInvited)
    .filter((guest) => !input.contactStatus || guest.contactStatus === input.contactStatus)
    .filter((guest) => !input.attendanceStatus || guest.attendanceStatus === input.attendanceStatus)
    .sort((left, right) => left.fullName.localeCompare(right.fullName, "fr-FR"));

  return {
    guests,
    nextToken: guestsPage.nextToken
  };
}

async function getInvitationGuestsByUsername(usernames: string[]): Promise<Map<string, InvitationGuest>> {
  if (usernames.length === 0) {
    return new Map();
  }

  const response = await documentClient.send(
    new BatchGetCommand({
      RequestItems: {
        [GUESTS_TABLE_NAME as string]: {
          Keys: usernames.map((username) => ({ username }))
        }
      }
    })
  );

  return new Map(
    ((response.Responses?.[GUESTS_TABLE_NAME as string] ?? []) as Record<string, unknown>[])
      .map(toInvitationGuest)
      .map((guest) => [guest.username, guest])
  );
}

async function listInvitedGuestsByEdition(input: {
  attendanceStatus?: InvitationAttendanceStatus;
  contactStatus?: InvitationContactStatus;
  editionId: string;
  limit?: number;
  nextToken?: string;
}): Promise<PaginatedInvitationGuests> {
  const expressionAttributeValues: Record<string, unknown> = {
    ":editionId": input.editionId
  };
  const filterExpressions: string[] = [];

  if (input.contactStatus) {
    expressionAttributeValues[":contactStatus"] = input.contactStatus;
    filterExpressions.push("contactStatus = :contactStatus");
  }

  if (input.attendanceStatus) {
    expressionAttributeValues[":attendanceStatus"] = input.attendanceStatus;
    filterExpressions.push("attendanceStatus = :attendanceStatus");
  }

  const response = await documentClient.send(
    new QueryCommand({
      TableName: STATUSES_TABLE_NAME,
      IndexName: EDITION_INDEX_NAME,
      KeyConditionExpression: "editionId = :editionId",
      ExpressionAttributeValues: expressionAttributeValues,
      FilterExpression: filterExpressions.length > 0 ? filterExpressions.join(" AND ") : undefined,
      ExclusiveStartKey: decodeNextToken(input.nextToken),
      Limit: normalizeLimit(input.limit)
    })
  );

  const statuses = ((response.Items ?? []) as Record<string, unknown>[]).map(toInvitationStatus);
  const guestsByUsername = await getInvitationGuestsByUsername(statuses.map((status) => status.username));
  const guests = statuses
    .map((status): InvitationGuestWithStatus | null => {
      const guest = guestsByUsername.get(status.username);

      if (!guest) {
        return null;
      }

      return {
        ...guest,
        editionId: status.editionId,
        contactStatus: status.contactStatus,
        attendanceStatus: status.attendanceStatus,
        isInvited: true,
        statusUpdatedAt: status.updatedAt
      };
    })
    .filter((guest): guest is InvitationGuestWithStatus => Boolean(guest))
    .sort((left, right) => left.fullName.localeCompare(right.fullName, "fr-FR"));

  return {
    guests,
    nextToken: encodeNextToken(response.LastEvaluatedKey as Record<string, unknown> | undefined)
  };
}

function invitationId(username: string, editionId: string): string {
  return `${username}#${editionId}`;
}

export async function inviteGuestToEdition(username: string, editionId: string): Promise<InvitationStatus> {
  const now = new Date().toISOString();
  const status: InvitationStatus = {
    invitationId: invitationId(username, editionId),
    username,
    editionId,
    contactStatus: DEFAULT_CONTACT_STATUS,
    attendanceStatus: DEFAULT_ATTENDANCE_STATUS,
    createdAt: now,
    updatedAt: now
  };

  await documentClient.send(
    new PutCommand({
      TableName: STATUSES_TABLE_NAME,
      Item: status,
      ConditionExpression: "attribute_not_exists(invitationId)"
    })
  ).catch((error: unknown) => {
    if (error && typeof error === "object" && "name" in error && error.name === "ConditionalCheckFailedException") {
      return;
    }

    throw error;
  });

  return status;
}

export async function uninviteGuestFromEdition(username: string, editionId: string): Promise<void> {
  await documentClient.send(
    new DeleteCommand({
      TableName: STATUSES_TABLE_NAME,
      Key: {
        invitationId: invitationId(username, editionId)
      }
    })
  );
}

export async function updateInvitationStatus(input: {
  attendanceStatus: InvitationAttendanceStatus;
  contactStatus: InvitationContactStatus;
  editionId: string;
  username: string;
}): Promise<InvitationStatus> {
  const response = await documentClient.send(
    new UpdateCommand({
      TableName: STATUSES_TABLE_NAME,
      Key: {
        invitationId: invitationId(input.username, input.editionId)
      },
      UpdateExpression: "SET contactStatus = :contactStatus, attendanceStatus = :attendanceStatus, updatedAt = :updatedAt",
      ConditionExpression: "attribute_exists(invitationId)",
      ExpressionAttributeValues: {
        ":contactStatus": input.contactStatus,
        ":attendanceStatus": input.attendanceStatus,
        ":updatedAt": new Date().toISOString()
      },
      ReturnValues: "ALL_NEW"
    })
  );

  return toInvitationStatus(response.Attributes as Record<string, unknown>);
}

export function parseInvitationContactStatus(value: unknown): InvitationContactStatus | undefined {
  return isInvitationContactStatus(value) ? value : undefined;
}

export function parseInvitationAttendanceStatus(value: unknown): InvitationAttendanceStatus | undefined {
  return isInvitationAttendanceStatus(value) ? value : undefined;
}
