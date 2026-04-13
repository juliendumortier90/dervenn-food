import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import {
  CreatePlanningAffectationInput,
  CreatePlanningBenevoleInput,
  CreatePlanningCategorieInput,
  CreatePlanningEditionInput,
  DEFAULT_PLANNING_CATEGORIES,
  DeletePlanningAffectationInput,
  PlanningAffectation,
  PlanningAffectationView,
  PlanningBenevole,
  PlanningCategorie,
  PlanningEdition,
  PlanningEditionSummary,
  UpdatePlanningBenevoleInput,
  UpdatePlanningCategorieInput,
  UpdatePlanningEditionInput
} from "../models/planning";

const TABLE_NAME = process.env.PLANNING_TABLE_NAME;

if (!TABLE_NAME) {
  throw new Error("PLANNING_TABLE_NAME environment variable is required");
}

const client = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(client);

const EDITION_INDEX_PK = "EDITIONS";

function editionPk(editionId: string): string {
  return `EDITION#${editionId}`;
}

function editionSummarySk(editionId: string): string {
  return `EDITION#${editionId}`;
}

function benevoleSk(benevoleId: string): string {
  return `BENEVOLE#${benevoleId}`;
}

function categorieSk(categorieId: string): string {
  return `CATEGORIE#${categorieId}`;
}

function affectationSk(affectationId: string): string {
  return `AFFECTATION#${affectationId}`;
}

function toPlanningEditionSummary(item: Record<string, unknown>): PlanningEditionSummary {
  return {
    editionId: String(item.editionId),
    title: String(item.title),
    startAt: String(item.startAt),
    endAt: String(item.endAt),
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt)
  };
}

function toPlanningBenevole(item: Record<string, unknown>): PlanningBenevole {
  return {
    benevoleId: String(item.benevoleId),
    pseudo: String(item.pseudo),
    phone: String(item.phone),
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt)
  };
}

function toPlanningCategorie(item: Record<string, unknown>): PlanningCategorie {
  return {
    categorieId: String(item.categorieId),
    title: String(item.title),
    color: String(item.color),
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt)
  };
}

function toPlanningAffectation(item: Record<string, unknown>): PlanningAffectation {
  return {
    affectationId: String(item.affectationId),
    benevoleId: String(item.benevoleId),
    categorieId: String(item.categorieId),
    comment: item.comment ? String(item.comment) : undefined,
    startAt: String(item.startAt),
    endAt: String(item.endAt),
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt)
  };
}

async function getEditionMetaItem(editionId: string): Promise<Record<string, unknown>> {
  const response = await documentClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: editionPk(editionId),
        sk: "META"
      }
    })
  );

  if (!response.Item) {
    throw new Error(`Edition ${editionId} not found`);
  }

  return response.Item as Record<string, unknown>;
}

export async function listPlanningEditions(): Promise<PlanningEditionSummary[]> {
  const response = await documentClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": EDITION_INDEX_PK
      },
      ScanIndexForward: false
    })
  );

  return (response.Items ?? []).map((item) => toPlanningEditionSummary(item as Record<string, unknown>));
}

export async function getPlanningEdition(editionId: string): Promise<PlanningEdition> {
  const response = await documentClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": editionPk(editionId)
      }
    })
  );

  const items = (response.Items ?? []) as Record<string, unknown>[];
  const metaItem = items.find((item) => item.entityType === "PLANNING_EDITION");

  if (!metaItem) {
    throw new Error(`Edition ${editionId} not found`);
  }

  const benevoles = items
    .filter((item) => item.entityType === "PLANNING_BENEVOLE")
    .map(toPlanningBenevole)
    .sort((left, right) => left.pseudo.localeCompare(right.pseudo, "fr-FR"));

  const categories = items
    .filter((item) => item.entityType === "PLANNING_CATEGORIE")
    .map(toPlanningCategorie)
    .sort((left, right) => left.title.localeCompare(right.title, "fr-FR"));

  const benevoleMap = new Map(benevoles.map((benevole) => [benevole.benevoleId, benevole]));
  const categorieMap = new Map(categories.map((categorie) => [categorie.categorieId, categorie]));
  const affectations = items
    .filter((item) => item.entityType === "PLANNING_AFFECTATION")
    .map(toPlanningAffectation)
    .sort((left, right) => {
      const timeComparison = left.startAt.localeCompare(right.startAt);

      if (timeComparison !== 0) {
        return timeComparison;
      }

      return left.affectationId.localeCompare(right.affectationId);
    })
    .map((affectation): PlanningAffectationView => {
      const benevole = benevoleMap.get(affectation.benevoleId);
      const categorie = categorieMap.get(affectation.categorieId);

      if (!benevole || !categorie) {
        throw new Error(`Edition ${editionId} contains incomplete affectation data`);
      }

      return {
        ...affectation,
        benevole,
        categorie
      };
    });

  return {
    ...toPlanningEditionSummary(metaItem),
    benevoles,
    categories,
    affectations
  };
}

export async function createPlanningEdition(input: CreatePlanningEditionInput): Promise<PlanningEditionSummary> {
  const editionId = randomUUID();
  const now = new Date().toISOString();
  const summary: PlanningEditionSummary = {
    editionId,
    title: input.title,
    startAt: input.startAt,
    endAt: input.endAt,
    createdAt: now,
    updatedAt: now
  };

  await documentClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              pk: EDITION_INDEX_PK,
              sk: editionSummarySk(editionId),
              entityType: "PLANNING_EDITION_SUMMARY",
              ...summary
            },
            ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)"
          }
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              pk: editionPk(editionId),
              sk: "META",
              entityType: "PLANNING_EDITION",
              ...summary
            },
            ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)"
          }
        },
        ...DEFAULT_PLANNING_CATEGORIES.map((categorie) => {
          const categorieId = randomUUID();

          return {
            Put: {
              TableName: TABLE_NAME,
              Item: {
                pk: editionPk(editionId),
                sk: categorieSk(categorieId),
                entityType: "PLANNING_CATEGORIE",
                categorieId,
                title: categorie.title,
                color: categorie.color,
                createdAt: now,
                updatedAt: now
              },
              ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)"
            }
          };
        })
      ]
    })
  );

  return summary;
}

export async function updatePlanningEdition(input: UpdatePlanningEditionInput): Promise<PlanningEditionSummary> {
  const existing = toPlanningEditionSummary(await getEditionMetaItem(input.editionId));
  const updatedAt = new Date().toISOString();
  const nextEdition = {
    ...existing,
    title: input.title,
    startAt: input.startAt,
    endAt: input.endAt,
    updatedAt
  };

  await documentClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TABLE_NAME,
            Key: {
              pk: editionPk(input.editionId),
              sk: "META"
            },
            UpdateExpression: "SET title = :title, startAt = :startAt, endAt = :endAt, updatedAt = :updatedAt",
            ExpressionAttributeValues: {
              ":title": nextEdition.title,
              ":startAt": nextEdition.startAt,
              ":endAt": nextEdition.endAt,
              ":updatedAt": nextEdition.updatedAt
            },
            ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)"
          }
        },
        {
          Update: {
            TableName: TABLE_NAME,
            Key: {
              pk: EDITION_INDEX_PK,
              sk: editionSummarySk(input.editionId)
            },
            UpdateExpression: "SET title = :title, startAt = :startAt, endAt = :endAt, updatedAt = :updatedAt",
            ExpressionAttributeValues: {
              ":title": nextEdition.title,
              ":startAt": nextEdition.startAt,
              ":endAt": nextEdition.endAt,
              ":updatedAt": nextEdition.updatedAt
            },
            ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)"
          }
        }
      ]
    })
  );

  return nextEdition;
}

export async function createPlanningBenevole(input: CreatePlanningBenevoleInput): Promise<PlanningBenevole> {
  await getEditionMetaItem(input.editionId);
  const now = new Date().toISOString();
  const benevole: PlanningBenevole = {
    benevoleId: randomUUID(),
    pseudo: input.pseudo,
    phone: input.phone,
    createdAt: now,
    updatedAt: now
  };

  await documentClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: editionPk(input.editionId),
        sk: benevoleSk(benevole.benevoleId),
        entityType: "PLANNING_BENEVOLE",
        ...benevole
      },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)"
    })
  );

  return benevole;
}

export async function updatePlanningBenevole(input: UpdatePlanningBenevoleInput): Promise<PlanningBenevole> {
  const existing = await documentClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: editionPk(input.editionId),
        sk: benevoleSk(input.benevoleId)
      }
    })
  );

  if (!existing.Item) {
    throw new Error(`Benevole ${input.benevoleId} not found`);
  }

  const updatedAt = new Date().toISOString();
  const response = await documentClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: editionPk(input.editionId),
        sk: benevoleSk(input.benevoleId)
      },
      UpdateExpression: "SET pseudo = :pseudo, phone = :phone, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":pseudo": input.pseudo,
        ":phone": input.phone,
        ":updatedAt": updatedAt
      },
      ReturnValues: "ALL_NEW",
      ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)"
    })
  );

  return toPlanningBenevole(response.Attributes as Record<string, unknown>);
}

export async function createPlanningCategorie(input: CreatePlanningCategorieInput): Promise<PlanningCategorie> {
  await getEditionMetaItem(input.editionId);
  const now = new Date().toISOString();
  const categorie: PlanningCategorie = {
    categorieId: randomUUID(),
    title: input.title,
    color: input.color,
    createdAt: now,
    updatedAt: now
  };

  await documentClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: editionPk(input.editionId),
        sk: categorieSk(categorie.categorieId),
        entityType: "PLANNING_CATEGORIE",
        ...categorie
      },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)"
    })
  );

  return categorie;
}

export async function updatePlanningCategorie(input: UpdatePlanningCategorieInput): Promise<PlanningCategorie> {
  const existing = await documentClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: editionPk(input.editionId),
        sk: categorieSk(input.categorieId)
      }
    })
  );

  if (!existing.Item) {
    throw new Error(`Categorie ${input.categorieId} not found`);
  }

  const updatedAt = new Date().toISOString();
  const response = await documentClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: editionPk(input.editionId),
        sk: categorieSk(input.categorieId)
      },
      UpdateExpression: "SET title = :title, color = :color, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":title": input.title,
        ":color": input.color,
        ":updatedAt": updatedAt
      },
      ReturnValues: "ALL_NEW",
      ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)"
    })
  );

  return toPlanningCategorie(response.Attributes as Record<string, unknown>);
}

async function ensureEntityExists(
  editionId: string,
  sk: string,
  entityName: string
): Promise<void> {
  const response = await documentClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: editionPk(editionId),
        sk
      }
    })
  );

  if (!response.Item) {
    throw new Error(`${entityName} not found`);
  }
}

export async function createPlanningAffectation(
  input: CreatePlanningAffectationInput
): Promise<PlanningAffectationView> {
  await getEditionMetaItem(input.editionId);
  await ensureEntityExists(input.editionId, benevoleSk(input.benevoleId), `Benevole ${input.benevoleId}`);
  await ensureEntityExists(input.editionId, categorieSk(input.categorieId), `Categorie ${input.categorieId}`);

  const now = new Date().toISOString();
  const affectation: PlanningAffectation = {
    affectationId: randomUUID(),
    benevoleId: input.benevoleId,
    categorieId: input.categorieId,
    comment: input.comment,
    startAt: input.startAt,
    endAt: input.endAt,
    createdAt: now,
    updatedAt: now
  };

  await documentClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: editionPk(input.editionId),
        sk: affectationSk(affectation.affectationId),
        entityType: "PLANNING_AFFECTATION",
        ...affectation
      },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)"
    })
  );

  const edition = await getPlanningEdition(input.editionId);
  const createdAffectation = edition.affectations.find(
    (currentAffectation) => currentAffectation.affectationId === affectation.affectationId
  );

  if (!createdAffectation) {
    throw new Error("Unable to build planning affectation");
  }

  return createdAffectation;
}

export async function deletePlanningAffectation(
  input: DeletePlanningAffectationInput
): Promise<PlanningAffectation> {
  const response = await documentClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: editionPk(input.editionId),
        sk: affectationSk(input.affectationId)
      },
      ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
      ReturnValues: "ALL_OLD"
    })
  ).catch((error: unknown) => {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
      throw new Error(`Affectation ${input.affectationId} not found`);
    }

    throw error;
  });

  if (!response.Attributes) {
    throw new Error(`Affectation ${input.affectationId} not found`);
  }

  return toPlanningAffectation(response.Attributes as Record<string, unknown>);
}
