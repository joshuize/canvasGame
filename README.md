# Canvas Game with Leaderboard

A playable browser game with a live, AWS-backed leaderboard. Play, submit a score, and see how it stacks up — no login, just a name and a score.

**Live demo:** https://d17ulm0ugyx5z0.cloudfront.net/
**Full portfolio:** https://dcqroimvaib72.cloudfront.net/

The game itself is forked from an open-source canvas shooter and extended with a scoring system tied to a real backend. On game over, the player can submit their score, which gets written to a database and immediately shown on a live top-10 leaderboard.

## Architecture

- **Front end:** Vanilla JavaScript canvas game, hosted as static files
- **Hosting:** S3 bucket behind a CloudFront distribution (Origin Access Control, bucket stays private)
- **API:** API Gateway (HTTP API), two routes:
  - `POST /scores` — submit a new score
  - `GET /scores` — return the top 10, sorted highest first
- **Compute:** Two single-purpose Lambda functions (Node.js) — one writes, one reads
- **Database:** DynamoDB (`GamingLeaderboard`) with a Global Secondary Index (`Scoring`) for efficient sorted queries, on-demand billing

```
Browser → CloudFront → S3 (static game)
              │
              ▼
        API Gateway (CORS-enabled)
         ├── POST /scores → submit-score Lambda ──┐
         │                                          ▼
         └── GET  /scores → get-leaderboard Lambda → DynamoDB (+ GSI)
```

## Why these choices

- **GSI over a table scan** — the main table's key is a per-item ID, useless for "top 10 by score." The GSI reindexes everything under a constant partition key with `score` as the sort key, so ranking is a single fast query.
- **On-demand billing** — no cost while idle, scales automatically if traffic ever spikes.
- **Two Lambdas, not one** — `submit-score` only writes, `get-leaderboard` only reads. Keeps each function's job (and permissions) minimal and easy to reason about.
- **HTTP API over REST API** — simpler, cheaper, didn't need REST API's extra features for this.

## Debugging trail

Everything worked in isolation before it worked together. Five separate issues, each needing a different diagnostic approach:

1. **Region mismatch** — the Lambda didn't show up in the console because it was created while pointed at a different region than the DynamoDB table.
2. **IAM propagation delay** — first write attempt failed with `AccessDeniedException` even with the right policy attached; a retry shortly after succeeded.
3. **Table name typo** — `ResourceNotFoundException` traced back to the code referencing `GalleryLeaderboard` while the table was actually named `GamingLeaderboard`.
4. **Field casing mismatch** — `ValidationException: Missing the key scoreid` — the table's key was lowercase `scoreid`, the code wrote camelCase `scoreId`. DynamoDB attribute names are case-sensitive.
5. **CORS and the `null` origin** — the browser blocked every request even with CORS configured correctly in API Gateway. Testing with `curl -v` against different `Origin` headers showed API Gateway returns proper CORS headers for real origins, but not for the literal `null` origin sent by a page opened directly from the filesystem (`file://`). Fix: serve locally over `http://localhost` during testing instead of opening the file directly.

## What's next

- Scope the Lambda IAM roles down from `AmazonDynamoDBFullAccess`/`ReadOnlyAccess` to a custom least-privilege policy on just this table
- Add lightweight abuse protection on score submission (signed token issued at game start, checked on submit)
- Custom domain instead of the raw CloudFront URL

## Stack

S3 · CloudFront · API Gateway (HTTP API) · Lambda (Node.js, AWS SDK v3) · DynamoDB (on-demand, GSI) · IAM · CloudWatch Logs
