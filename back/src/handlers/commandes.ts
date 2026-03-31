import { APIGatewayProxyHandler } from "aws-lambda";
import {
  createCommande,
  deleteCommande,
  listCommandes,
  listReadyCommandes,
  updateCommandeStatus
} from "../services/repository";
import { jsonResponse } from "../services/http";
import { parseBaseType, parseCommandeNumber, parseComment, parseStatus } from "../services/validation";

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      if (event.resource === "/commandes/pretes" || event.path.endsWith("/commandes/pretes")) {
        const commandes = await listReadyCommandes();
        return jsonResponse(200, { commandes });
      }

      const commandes = await listCommandes();
      return jsonResponse(200, { commandes });
    }

    if (event.httpMethod !== "POST") {
      return jsonResponse(405, { message: "Method not allowed" });
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const action = body.action ?? event.queryStringParameters?.action ?? "create";

    if (action === "create") {
      const commande = await createCommande({
        commandeNumber: parseCommandeNumber(body.commandeNumber),
        baseType: parseBaseType(body.baseType),
        comment: parseComment(body.comment)
      });

      return jsonResponse(201, { commande });
    }

    if (action === "update-status") {
      const commande = await updateCommandeStatus(
        parseCommandeNumber(body.commandeNumber),
        parseStatus(body.status)
      );

      return jsonResponse(200, { commande });
    }

    if (action === "delete") {
      const commande = await deleteCommande(parseCommandeNumber(body.commandeNumber));
      return jsonResponse(200, { commande });
    }

    return jsonResponse(400, { message: "Invalid action" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const statusCode =
      message.includes("not found")
        ? 404
        : message.startsWith("Invalid")
          ? 400
          : message.includes("already exists") || message.includes("cannot be deleted")
            ? 409
            : 500;

    return jsonResponse(statusCode, {
      message: "Unable to process commande request",
      error: message
    });
  }
};
