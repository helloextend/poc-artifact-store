# Extend Artifact Store (poc-artifact-store)

An Extend-owned home for what AI tools produce: web pages, diagrams, SVG, React components, and
Markdown docs. Any client publishes over MCP or REST; anyone with access opens it in a browser.
Data lives here, so the chat client is replaceable. Architecture: https://claude.ai/artifact/BtExo4q8agF8nDBo9tBV26

Serverless only: one Lambda (Function URL), one DynamoDB table, one private S3 bucket, one
Secrets Manager secret. No containers, no VPC.

## Interfaces

| Door | Auth | What |
|---|---|---|
| `POST /mcp` | Okta bearer | MCP tools: `publish_artifact`, `get_artifact`, `search_artifacts`, `share_artifact`, `get_artifact_link` |
| `POST /v1/artifacts` | Okta bearer | publish (new, or new version when `id` is given) |
| `GET /v1/artifacts?q=` | Okta bearer | my artifacts, newest first |
| `GET /v1/artifacts/:id?version=` | Okta bearer | read (latest or a version) |
| `POST /v1/artifacts/:id/shares` | Okta bearer | owner shares with `everyone` or `user:<email>`, `view` or `edit` |
| `POST /v1/artifacts/:id/link` | Okta bearer | 7-day view link |
| `GET /a/:id?t=` | signed link | viewer page; artifact runs in a sandboxed iframe with a strict CSP |

Access: the owner edits; shares grant view or edit. Anything you can't see is a 404, so ids don't leak.
Versions are append-only with optimistic concurrency.

## Data

Single table, house conventions: `itemId`/`sortKey`, `ARTIFACT::<id>` with `META::`,
`VERSION::000001`, `SHARE::<principal>`; `entityType` on every item; `EntityType` and sparse `Owner`
(ownerEmail + updatedAt) indexes. Content lives in S3 at `artifacts/<id>/v<n>`.

## POC shortcuts (deliberate)

- MCP runs in the same Lambda in stateless mode, not a separate AgentCore runtime.
- Okta uses the Chorus app / `mcp` authorization server like the gateway POC; an official app comes later.
- The browser viewer uses short-lived signed links instead of its own Okta sign-in.
- Search is title-contains over your own artifacts; shared-with-me listing is not built yet.

## Develop

```sh
pnpm install
pnpm test        # needs Docker: DynamoDB Local on :8000 (house dynamo-local)
pnpm typecheck
pnpm synth       # exbuild --skinny + cdk synth
```

Not deployed. There is no GitHub workflow, so pushing does not deploy.

AI-generated code (Claude), reviewed by the repo owner.
