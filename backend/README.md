# Leaderboard Backend

Serverless leaderboard API for canvasGame, built with AWS SAM and deployed
automatically via GitHub Actions using OIDC (no long-lived AWS keys).

**Stack:** API Gateway (HTTP API) -> Lambda (Node.js 20) -> DynamoDB

```
POST /scores   { "playerName": "...", "score": 1234 }   -> submit a score
GET  /scores                                            -> top 10 scores
```

## One-time setup (do this before the pipeline can deploy)

1. **Check for an existing GitHub OIDC provider** in your AWS account
   (an account can only have one):
   ```bash
   aws iam list-open-id-connect-providers
   ```
   If `token.actions.githubusercontent.com` is already listed, you'll pass
   `CreateOidcProvider=false` below.

2. **Deploy the bootstrap stack** (creates the OIDC provider if needed, plus
   the IAM role GitHub Actions will assume):
   ```bash
   cd backend/bootstrap
   aws cloudformation deploy \
     --template-file github-oidc-role.yaml \
     --stack-name canvasGame-gha-oidc \
     --capabilities CAPABILITY_NAMED_IAM \
     --parameter-overrides CreateOidcProvider=true
   ```

3. **Grab the role ARN from the stack output:**
   ```bash
   aws cloudformation describe-stacks \
     --stack-name canvasGame-gha-oidc \
     --query "Stacks[0].Outputs[0].OutputValue" --output text
   ```

4. **Add it to GitHub:** repo Settings -> Secrets and variables -> Actions ->
   Variables tab -> New repository variable ->
   name `AWS_DEPLOY_ROLE_ARN`, value = the ARN from step 3.

5. **Add a `prod` environment** (Settings -> Environments -> New environment,
   name it `prod`) so the deploy job's `environment: prod` line resolves.
   You can leave it unprotected for now, or require your own approval before
   deploys run.

That's it — from here, every push to `main` that touches `backend/**` builds
and deploys automatically. PRs get validated and built (not deployed) so
you catch template/syntax errors before merge.

## Local testing

```bash
cd backend
sam build
sam local invoke GetScoresFunction
sam local start-api   # test against http://127.0.0.1:3000/scores
```

## Cutover from the old manually-created resources

This template creates a **new** table (`canvasGame-leaderboard-prod`) and a
**new** API endpoint — it does not touch the existing `GamingLeaderboard`
table or the `rshxcn6a55` API Gateway. Once `sam deploy` succeeds:

1. Grab the new API URL from the stack output (`ApiUrl`).
2. Update `LEADERBOARD_API_URL` in `index.js` to point at it.
3. Play a round, submit a score, confirm it round-trips.
4. Only then, manually delete the old `GamingLeaderboard` table and the old
   API Gateway from the console.
