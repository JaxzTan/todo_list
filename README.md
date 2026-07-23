# Exec Board

A persistent, three-layer task board (project → task → subtask) driven from ordinary conversation with a Claude skill, backed by a Next.js web app and PostgreSQL.

## What it does

Exec Board tracks multi-step, multi-session work without a separate act of "updating the tracker." A Claude skill client and a web app both read/write the same board through one API, so a plan you state in chat, its status changes, blockers, and decisions are captured automatically and survive across sessions — with a single markdown file as the portable export format. See `docs/3 Layers Rule PRD (1).md` (PRD) for goals and user stories, and `architecture.md` / `docs/3 Layers Rule PRD (3).md` (TRD) for the full system design.

## Requirements

- Node.js 24
- Docker + Docker Compose (for local Postgres)
- `ngrok` (only needed to expose the app to the Claude skill sandbox)

## Setup

1. Install dependencies:
   ```
   npm ci
   ```
2. Create `.env` in the repo root with the variables listed under [Configuration](#configuration) below.
3. Start Postgres:
   ```
   npm run db:up
   ```
4. Run migrations and generate the Prisma client:
   ```
   npm run db:migrate
   npm run db:generate
   ```
5. Sync the `exec_board_app` role's password (RLS-scoped DB role) from `.env`:
   ```
   bash scripts/setup-db-role.sh
   ```
6. Issue a personal access token per user (prints the raw token once — save it):
   ```
   node --env-file=.env scripts/issue-token.mts <handle>
   ```

## Running it

**Local dev (no Docker for the app):**
```
npm run dev
```
App runs at `http://localhost:3000`.

**Full stack via Docker Compose** (app + Postgres, with file-watch hot reload):
```
make up      # build + start, prints the web URL
make logs    # follow logs
make down    # stop and remove containers
```

**Expose to the Claude skill sandbox via ngrok:**
```
make tunnel       # starts the stack (if not up) + watch mode + ngrok in the foreground
make stop-tunnel  # stop the tunnel and watch mode (containers keep running)
```

## Configuration (env vars)

| Variable | Purpose |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Local Postgres connection, used by `docker-compose.yml` |
| `DATABASE_URL` | Full connection string used by Prisma migrations (superuser role) |
| `APP_DATABASE_URL` | Connection string for the RLS-scoped `exec_board_app` role the app itself uses at runtime |
| `APP_DB_PASSWORD` | Password synced onto the `exec_board_app` role by `scripts/setup-db-role.sh` |
| `PAT_JAXZ`, `PAT_JAYCI` | Per-user bearer tokens (see `scripts/issue-token.mts`) — never committed, never written into board files |
| `NGROK` | ngrok auth/config used by `scripts/start-tunnel.sh` to expose `localhost:3000` |

`.env` is gitignored; there is no committed `.env.example` yet — see the variable names above or `docker-compose.yml` / `prisma.config.ts` for how each is consumed.

## Common commands

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / start |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `npm test` | Vitest (root + workspace packages, e.g. `board-codec`) |
| `npm run e2e` | Playwright end-to-end tests |
| `npm run db:up` / `db:down` | Start/stop the Postgres container |
| `npm run db:migrate` / `db:generate` | Run Prisma migrations / regenerate the Prisma client |
| `npm run db:backup` | Run `scripts/backup-db.sh` (`pg_dump` backup) |
| `make up` / `down` / `stop` / `logs` / `clean` | Docker Compose stack lifecycle |
| `make tunnel` / `stop-tunnel` | Start/stop the ngrok tunnel + watch mode |
| `node --env-file=.env scripts/issue-token.mts <handle>` | Issue a new PAT for a user |
| `bash scripts/setup-db-role.sh` | Sync the app DB role's password from `.env` |

CI (`.github/workflows/ci.yml`) runs typecheck+lint, unit tests, Playwright e2e, and a Prisma migration drift check on every PR and push to `main`.

## Troubleshooting

| Symptom | Cause → Fix |
|---|---|
| API returns `401 {"error":"unauthorized"}` | Missing/invalid bearer token → issue one with `scripts/issue-token.mts` and send `Authorization: Bearer <PAT>` |
| API returns `404` for a board you believe exists | Board belongs to another user, or the slug is wrong — cross-tenant lookups intentionally 404 instead of 403 (see `architecture.md`) |
| `409 conflict` when setting a node to `doing` | Only one `doing` step is allowed per board at a time — resolve or move the current one first |
| `409 conflict` when setting a node to `stuck` | A `blocker` object is required on the same request |
| `make tunnel` fails to reach the skill client the next day | Free-tier ngrok hostnames rotate on restart — see the "Infrastructure & environments" section of the TRD for the reserved-domain / resolver fix |
| Skill client isn't syncing to the API | It falls back to local file mode (`.exec-board/`) when `/api/health` is unreachable; check the container/tunnel are up, then re-sync — the next successful sync imports the local file as a new revision rather than overwriting |
| `exec_board_app` role auth fails after changing `.env` | Re-run `bash scripts/setup-db-role.sh` to sync the role's password |
