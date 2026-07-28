import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME;
const GAME_ID = "canvasGame";
const MAX_NAME_LENGTH = 20;

const response = (statusCode, body) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }

  const { playerName, score } = payload;

  if (typeof playerName !== "string" || playerName.trim().length === 0) {
    return response(400, { error: "playerName is required" });
  }
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
    return response(400, { error: "score must be a non-negative number" });
  }

  const item = {
    scoreId: randomUUID(),
    gameId: GAME_ID,
    playerName: playerName.trim().slice(0, MAX_NAME_LENGTH),
    score: Math.floor(score),
    submittedAt: new Date().toISOString(),
  };

  try {
    await client.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  } catch (err) {
    console.error("Failed to write score:", err);
    return response(500, { error: "Failed to save score" });
  }

  return response(201, { ok: true, score: item });
};
