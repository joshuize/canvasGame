import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME;
const GAME_ID = "canvasGame";
const TOP_N = 10;

const response = (statusCode, body) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async () => {
  try {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "Scoring",
        KeyConditionExpression: "gameId = :gameId",
        ExpressionAttributeValues: { ":gameId": GAME_ID },
        ScanIndexForward: false, // descending by score (range key)
        Limit: TOP_N,
      })
    );

    const scores = (result.Items || []).map((item) => ({
      playerName: item.playerName,
      score: item.score,
      submittedAt: item.submittedAt,
    }));

    return response(200, { scores });
  } catch (err) {
    console.error("Failed to fetch scores:", err);
    return response(500, { error: "Failed to fetch leaderboard" });
  }
};
