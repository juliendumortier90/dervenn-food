import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import { BaseType, Commande, CommandeStatus, CreateCommandeInput } from "../models/commande";

const TABLE_NAME = process.env.TABLE_NAME;

if (!TABLE_NAME) {
  throw new Error("TABLE_NAME environment variable is required");
}

const client = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(client);

const COMMAND_PK = "COMMAND";

function formatOrderSortKey(commandeNumber: number): string {
  return commandeNumber.toString().padStart(6, "0");
}

function toCommande(item: Record<string, unknown>): Commande {
  return {
    commandeNumber: Number(item.commandeNumber),
    baseType: item.baseType as BaseType,
    comment: (item.comment as string | undefined) ?? "",
    status: item.status as CommandeStatus,
    createdAt: String(item.createdAt),
    readyAt: item.readyAt ? String(item.readyAt) : undefined,
    updatedAt: String(item.updatedAt)
  };
}

export async function listCommandes(): Promise<Commande[]> {
  const response = await documentClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": COMMAND_PK
      },
      ScanIndexForward: true
    })
  );

  return (response.Items ?? []).map(toCommande);
}

export async function createCommande(input: CreateCommandeInput): Promise<Commande> {
  const now = new Date().toISOString();
  const item: Commande = {
    commandeNumber: input.commandeNumber,
    baseType: input.baseType,
    comment: input.comment?.trim() ?? "",
    status: CommandeStatus.A_FAIRE,
    createdAt: now,
    updatedAt: now
  };

  await documentClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: COMMAND_PK,
        sk: formatOrderSortKey(input.commandeNumber),
        entityType: "COMMANDE",
        ...item
      },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)"
    })
  ).catch((error: unknown) => {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
      throw new Error(`Commande ${input.commandeNumber} already exists`);
    }

    throw error;
  });

  return item;
}

export async function updateCommandeStatus(
  commandeNumber: number,
  status: CommandeStatus
): Promise<Commande> {
  const key = {
    pk: COMMAND_PK,
    sk: formatOrderSortKey(commandeNumber)
  };

  const existing = await documentClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: key
    })
  );

  if (!existing.Item) {
    throw new Error(`Commande ${commandeNumber} not found`);
  }

  const updatedAt = new Date().toISOString();
  const expressionAttributeNames: Record<string, string> = {
    "#status": "status"
  };
  const expressionAttributeValues: Record<string, unknown> = {
    ":status": status,
    ":updatedAt": updatedAt
  };
  let updateExpression = "SET #status = :status, updatedAt = :updatedAt";

  if (status === CommandeStatus.PRETE) {
    expressionAttributeValues[":readyAt"] = updatedAt;
    updateExpression += ", readyAt = :readyAt";
  } else if (status === CommandeStatus.A_FAIRE || status === CommandeStatus.EN_COURS) {
    updateExpression += " REMOVE readyAt";
  }

  const response = await documentClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW"
    })
  );

  if (!response.Attributes) {
    throw new Error(`Unable to update commande ${commandeNumber}`);
  }

  return toCommande(response.Attributes);
}

export async function deleteCommande(commandeNumber: number): Promise<Commande> {
  const key = {
    pk: COMMAND_PK,
    sk: formatOrderSortKey(commandeNumber)
  };

  const existing = await documentClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: key
    })
  );

  if (!existing.Item) {
    throw new Error(`Commande ${commandeNumber} not found`);
  }

  if (existing.Item.status !== CommandeStatus.A_FAIRE) {
    throw new Error(`Commande ${commandeNumber} cannot be deleted`);
  }

  const response = await documentClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: key,
      ConditionExpression: "#status = :status",
      ExpressionAttributeNames: {
        "#status": "status"
      },
      ExpressionAttributeValues: {
        ":status": CommandeStatus.A_FAIRE
      },
      ReturnValues: "ALL_OLD"
    })
  ).catch((error: unknown) => {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
      throw new Error(`Commande ${commandeNumber} cannot be deleted`);
    }

    throw error;
  });

  if (!response.Attributes) {
    throw new Error(`Unable to delete commande ${commandeNumber}`);
  }

  return toCommande(response.Attributes);
}
