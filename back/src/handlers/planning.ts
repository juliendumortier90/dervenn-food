import { APIGatewayProxyHandler } from "aws-lambda";
import {
  createPlanningAffectation,
  createPlanningBenevole,
  createPlanningCategorie,
  createPlanningEdition,
  deletePlanningAffectation,
  getPlanningEdition,
  listPlanningEditions,
  updatePlanningBenevole,
  updatePlanningCategorie,
  updatePlanningEdition
} from "../services/planningRepository";
import { jsonResponse } from "../services/http";
import {
  assertPlanningDateRange,
  parsePlanningColor,
  parsePlanningComment,
  parsePlanningDateTime,
  parsePlanningEntityId,
  parsePlanningPhone,
  parsePlanningTitle
} from "../services/planningValidation";

function parseBody(body: string | null): Record<string, unknown> {
  if (!body) {
    return {};
  }

  return JSON.parse(body) as Record<string, unknown>;
}

function isAdminPath(path: string): boolean {
  return path.startsWith("/planning/admin");
}

function isEditionsCollectionPath(path: string): boolean {
  return path === "/planning/editions" || path === "/planning/admin/editions";
}

function isEditionItemPath(path: string, editionId?: string): boolean {
  if (!editionId) {
    return false;
  }

  return path === `/planning/editions/${editionId}` || path === `/planning/admin/editions/${editionId}`;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const path = event.path ?? "";
  const editionId = event.pathParameters?.editionId;

  try {
    if (event.httpMethod === "GET" && isEditionsCollectionPath(path)) {
      const editions = await listPlanningEditions();
      return jsonResponse(200, { editions });
    }

    if (event.httpMethod === "GET" && isEditionItemPath(path, editionId)) {
      if (!editionId) {
        return jsonResponse(404, { message: "Planning resource not found" });
      }

      const edition = await getPlanningEdition(editionId);
      return jsonResponse(200, { edition });
    }

    if (event.httpMethod !== "POST" || !isAdminPath(path)) {
      return jsonResponse(405, { message: "Method not allowed" });
    }

    const body = parseBody(event.body ?? null);

    if (isEditionsCollectionPath(path)) {
      const title = parsePlanningTitle(body.title);
      const startAt = parsePlanningDateTime(body.startAt, "startAt");
      const endAt = parsePlanningDateTime(body.endAt, "endAt");
      assertPlanningDateRange(startAt, endAt);

      const edition = await createPlanningEdition({
        title,
        startAt,
        endAt
      });

      return jsonResponse(201, { edition });
    }

    if (!editionId || !isEditionItemPath(path, editionId)) {
      return jsonResponse(404, { message: "Planning resource not found" });
    }

    const action = body.action;

    if (action === "update-edition") {
      const title = parsePlanningTitle(body.title);
      const startAt = parsePlanningDateTime(body.startAt, "startAt");
      const endAt = parsePlanningDateTime(body.endAt, "endAt");
      assertPlanningDateRange(startAt, endAt);

      const edition = await updatePlanningEdition({
        editionId,
        title,
        startAt,
        endAt
      });

      return jsonResponse(200, { edition });
    }

    if (action === "create-benevole") {
      const benevole = await createPlanningBenevole({
        editionId,
        pseudo: parsePlanningTitle(body.pseudo, "pseudo"),
        phone: parsePlanningPhone(body.phone)
      });

      return jsonResponse(201, { benevole });
    }

    if (action === "update-benevole") {
      const benevole = await updatePlanningBenevole({
        editionId,
        benevoleId: parsePlanningEntityId(body.benevoleId, "benevoleId"),
        pseudo: parsePlanningTitle(body.pseudo, "pseudo"),
        phone: parsePlanningPhone(body.phone)
      });

      return jsonResponse(200, { benevole });
    }

    if (action === "create-categorie") {
      const categorie = await createPlanningCategorie({
        editionId,
        title: parsePlanningTitle(body.title),
        color: parsePlanningColor(body.color)
      });

      return jsonResponse(201, { categorie });
    }

    if (action === "update-categorie") {
      const categorie = await updatePlanningCategorie({
        editionId,
        categorieId: parsePlanningEntityId(body.categorieId, "categorieId"),
        title: parsePlanningTitle(body.title),
        color: parsePlanningColor(body.color)
      });

      return jsonResponse(200, { categorie });
    }

    if (action === "create-affectation") {
      const startAt = parsePlanningDateTime(body.startAt, "startAt");
      const endAt = parsePlanningDateTime(body.endAt, "endAt");
      assertPlanningDateRange(startAt, endAt);

      const affectation = await createPlanningAffectation({
        editionId,
        benevoleId: parsePlanningEntityId(body.benevoleId, "benevoleId"),
        categorieId: parsePlanningEntityId(body.categorieId, "categorieId"),
        comment: parsePlanningComment(body.comment),
        startAt,
        endAt
      });

      return jsonResponse(201, { affectation });
    }

    if (action === "delete-affectation") {
      const affectation = await deletePlanningAffectation({
        editionId,
        affectationId: parsePlanningEntityId(body.affectationId, "affectationId")
      });

      return jsonResponse(200, { affectation });
    }

    return jsonResponse(400, { message: "Invalid action" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const statusCode =
      message.includes("not found")
        ? 404
        : message.startsWith("Invalid")
          ? 400
          : message.includes("already exists")
            ? 409
            : 500;

    return jsonResponse(statusCode, {
      message: "Unable to process planning request",
      error: message
    });
  }
};
