<div align="center">

# Tubeboard

**A persistent three-layer task board (project → task → subtask), driven from ordinary conversation with a Claude skill or a browser.**

[Documentation](./docs) · [Architecture](./architecture.md) · [Endpoint reference](./docs/endpoint.md) · [Report a bug](https://github.com/JaxzTan/todo_list/issues/new)

</div>

<!-- TODO: add a demo.gif or screenshot of the board view under docs/assets/ and link it here -->

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Development](#development)
- [Testing](#testing)
- [API](#api)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## About

Tubeboard is a task tracker built around one idea: the plan and the actual status shouldn't be two things that drift apart. It's driven either from ordinary conversation — a Claude skill infers status changes (done, blocked, stuck, scope cuts) from what you say and writes them silently — or from a normal web UI, and both stay in sync because they operate on the same API and the same event log.

**Why it exists:** most task trackers require you to context-switch out of the conversation to update them, so they fall out of date. This one is written to from inside the conversation itself.

**Status:** Active development · **Current version:** 0.1.0

---

## Features

- **Two clients, one source of truth** — a Claude skill (in-chat) and a Next.js web app both operate on the same board API, so a plan stated in chat and its status changes stay in sync automatically
- **Three-layer node tree** (project/phase → task → subtask) with a server-derived "next action" — never stored client-side, always recomputed
- **Append-only event log** (`Event`) is the source of truth; every mutation is reversible via a compensating revert, never a deletion
- **Postgres row-level security**, keyed per-transaction, isolates each user's boards at the database layer — not just at the query layer
- **Lossless markdown import/export** (`board-codec`) so a board is portable as a single `.md` file
- **Handle + password login** mints an expiring session token (up to 3 per user, so the browser and the Claude skill don't log each other out); every route but `/api/health` and `/api/auth/login` requires it as a bearer token. Google/GitHub OAuth buttons are on the login page, pending provider setup

**Not included, by design:**
- No self-serve signup — accounts and passwords are issued via an operator-run CLI script (`scripts/set-password.mts`), not a public form
- No hosted deployment — this runs on a local machine behind an ngrok tunnel; see [Deployment](#deployment)

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Full stack | Next.js 16 (App Router), React 19, TypeScript | One framework, one deployable — doesn't justify a split frontend/backend at this scale |
| Styling | TailwindCSS v4 | Board view is mostly tables and status pills |
| Shared format | `board-codec` (TypeScript workspace package) | One grammar owner for markdown ⇄ JSON prevents skill/app drift |
| Database | PostgreSQL 17 + Prisma 7 (`@prisma/adapter-pg`) | Relational fits steps/notes/blockers cleanly |
| Isolation | Postgres row-level security (RLS) | Query-level `WHERE ownerId = ?` scoping will eventually be forgotten once |
| Auth | Argon2-hashed password + session token (`@node-rs/argon2`), bearer token | One credential path, one downstream auth check |
| DB runtime | Docker Compose, named volume | Reproducible, disposable, no host Postgres install |
| Exposure | ngrok tunnel | Zero-infra way to reach a local app from the Claude skill sandbox |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | Typecheck, unit tests, Playwright e2e, Prisma migration-drift check |

---

## Quick Start

### Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | 24 | `node --version` |
| Docker + Docker Compose | any recent | `docker compose version` |
| `make` | any | `make --version` |
| `ngrok` | any (only to expose the app to the Claude skill sandbox) | `ngrok --version` |

### Install & run

```bash
# 1. Clone
git clone git@github.com:JaxzTan/todo_list.git
cd todo_list
npm install

# 2. Configure — create .env with the variables listed under Configuration below

# 3. Start Postgres, apply the schema, sync the RLS app role's password
npm run db:up
npm run db:migrate && npm run db:generate
bash scripts/setup-db-role.sh

# 4. Create your first user
node --env-file=.env scripts/set-password.mts <handle> <password>
# or: make reset   — applies every USER<n>/PASSWORD<n> pair from .env

# 5. Run
npm run dev
```

Open **http://localhost:3300**.

Alternatively, run the full stack (app + Postgres) via Docker Compose:

```bash
make up      # build + start, prints the web URL
make logs    # follow logs
make down    # stop and remove containers
```

### Teardown

```bash
make down    # stop containers
make clean   # stop + remove volumes (destroys local data — see Troubleshooting)
```

---

## Configuration

| Variable | Required | Default | Description |
|---|:--:|---|---|
| `DATABASE_URL` | **yes** | — | Postgres connection string, superuser role (migrations, Prisma Studio) |
| `APP_DATABASE_URL` | **yes** | — | Postgres connection string, RLS-scoped `exec_board_app` role (app runtime) |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` / `DB_PORT` / `DB_HOST` | **yes** | — | Local Postgres container credentials/connection, used by `docker-compose.yml` |
| `APP_DB_PASSWORD` | **yes** | — | 🔒 Synced into the `exec_board_app` role by `scripts/setup-db-role.sh` |
| `NGROK` | no | — | 🔒 ngrok auth token, used by `scripts/start-tunnel.sh` |
| `USER<n>` / `PASSWORD<n>` | no | — | 🔒 Accounts for `make reset` and e2e; also ngrok basic auth. `USER1`/`PASSWORD1` is the skill client's default login |
| `EXEC_BOARD_BASE_URL` | no | `http://localhost:3300` | Base URL the skill client calls; falls back to local file mode if unreachable |
| `EXEC_BOARD_HANDLE` / `EXEC_BOARD_PASSWORD` | no | `USER1` / `PASSWORD1` | 🔒 Account the skill client logs in as; its session token is cached in `.exec-board/session-token` |
| `EXEC_BOARD_LOCAL_DIR` | no | `.exec-board/` | Local fallback directory the skill client writes to when the API is unreachable |
| `EXEC_BOARD_BACKUP_DIR` | no | `backups/` | Where `scripts/backup-db.sh` writes `.dump` files |
| `EXEC_BOARD_BACKUP_RETENTION_DAYS` | no | `14` | How long `scripts/backup-db.sh` keeps old backups |

🔒 = secret. Never commit. `.env` is gitignored.

---

## Usage

Every route but `GET /api/health` and `POST /api/auth/login` requires a bearer session token. Log in first:

```bash
curl -X POST http://localhost:3300/api/auth/login \
  -H "content-type: application/json" \
  -d '{"handle":"jaxz","password":"..."}'
# → {"token":"ebsess_..."}
```

Then send it as a bearer token:

```bash
curl http://localhost:3300/api/boards/my-project \
  -H "Authorization: Bearer $TOKEN"
```
```json
{"board":{"slug":"my-project","title":"..."},"nodes":[...],"nextAction":{"nodeId":"...","number":"1.2","text":"..."},"counts":{"done":3,"total":9}}
```

Full endpoint reference: [`docs/endpoint.md`](./docs/endpoint.md).

---

## Project Structure

```
.
├── app/                 # Next.js App Router — pages + API route handlers
│   ├── api/             #   REST endpoints (boards, nodes, events, auth)
│   ├── boards/          #   Board list + board detail pages
│   ├── login/           #   Login page (handle + password, OAuth buttons)
│   └── components/      #   Client components (BoardTree, MatrixView, dialogs)
├── lib/
│   ├── auth/            # Password login, session tokens, tenant resolution
│   ├── boards/          # Board service layer — mutations, events, next-action
│   ├── client/           # Browser-side API client, auth/i18n/theme contexts
│   ├── api/              # Shared route-handler helpers (error mapping, JSON parsing)
│   └── db.ts              # Prisma client + RLS transaction wrapper
├── packages/board-codec/ # Sole owner of the markdown ⇄ JSON grammar
├── prisma/                # Schema + migrations
├── scripts/                # Operator CLIs (set-password, board-client, backup, tunnel)
├── e2e/                    # Playwright end-to-end tests
├── docs/
│   ├── endpoint.md         # Full API reference
│   ├── list.md              # Build history and decisions made alo the way
│   └── dual-login-plan.md   # Design doc for the former PAT/password dual login (PATs since removed)
├── .claude/skills/exec-board/ # The Claude skill definition (SKILL.md)
├── docker-compose.yml
├── Dockerfile
├── Makefile
└── architecture.md          # Full system design — see below
```

---

## Development

| Command | Does |
|---|---|
| `npm run dev` | Next.js dev server, http://localhost:3300 |
| `npm test` | Vitest (root + `board-codec` workspace) |
| `npm run e2e` | Playwright end-to-end tests |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:up` / `db:down` | Start/stop local Postgres via Docker Compose |
| `npm run db:migrate` / `db:generate` | Apply Prisma migrations / regenerate the client |
| `npm run db:backup` | Run `scripts/backup-db.sh` on demand |
| `npm run tunnel:start` / `tunnel:stop` | ngrok tunnel for the Claude skill sandbox |
| `make up` / `make down` / `make logs` | Full stack via Docker Compose |
| `make dev` | Full stack with live source sync + hot reload (`docker compose watch`) |
| `make tunnel` | `make dev` plus ngrok attached in the foreground |

### Conventions

Personal project, solo-maintained — no formal PR review process. Commit messages follow a loose Conventional Commits style (`feat:`, `fix:`, `perf:`, `refactor:`, `chore:`) without enforced scopes.

### Architecture

Design rationale, boundaries, and data flow live in **[architecture.md](./architecture.md)** — read it before a non-trivial change.

---

## Testing

```bash
npm test          # Vitest — unit + real-Postgres integration tests
npm run e2e        # Playwright — full browser flows
```

| Layer | Tool | Scope | Where |
|---|---|---|---|
| Unit / integration | Vitest | Service logic + real-Postgres RLS/tenancy tests | `lib/**/*.test.ts`, `app/**/*.test.ts` |
| Format round-trip | Vitest + fast-check | `board-codec`'s markdown ⇄ JSON grammar, property + golden-file tests | `packages/board-codec/test/` |
| E2E | Playwright | Full browser flow: login → create board → add step → status change → export | `e2e/board.spec.ts` |

CI (`.github/workflows/ci.yml`) runs typecheck+lint, unit tests, Playwright e2e, and a Prisma migration-drift check on every PR and push to `main`.

---

## API

Base URL: `http://localhost:3300/api` · Auth: `Authorization: Bearer <session token>`

| Group | Purpose |
|---|---|
| `/auth/login` | Password login → session token |
| `/boards` | List / create boards |
| `/boards/:slug`, `/boards/:slug/nodes*` | Board detail, node CRUD, notes |
| `/boards/:slug/events*` | Event log, compensating revert |
| `/boards/:slug/sessions`, `/report`, `/markdown` | Work sessions, report generation, markdown export |
| `/boards/:slug/rebuild` | Replay the event log and repair drifted status |
| `/boards/import` | Import a markdown board |

Full reference, request/response shapes, and error codes: **[docs/endpoint.md](./docs/endpoint.md)**.

---

## Deployment

There is no hosted deployment — this is a personal, single-machine tool. The real "deployment" is:

```bash
make up             # app + Postgres, both in Docker
npm run tunnel:start # ngrok tunnel, so the Claude skill sandbox can reach it
```

Full topology and the reasoning behind "no hosted environment" → [architecture.md §15](./architecture.md#15-deployment--environments).

---

## Troubleshooting

<details>
<summary>Postgres port already in use</summary>

Set a different `DB_PORT` in `.env`, or stop whatever's already bound to it.
</details>

<details>
<summary><code>prisma</code> commands hang with no output</summary>

This has been observed to hang indefinitely (even `prisma --version`) on some host Node installs, unrelated to schema changes. Workaround: run it inside the `web` container instead — `docker compose exec web npx prisma <command>` — which has been reliable throughout development. If you edit `prisma/schema.prisma` on the host, `docker cp` it into the container first.
</details>

<details>
<summary>Daily backup cron/launchd job fails with "Operation not permitted"</summary>

On macOS, this project's directory lives under `~/Documents`, which is TCC-protected — *any* non-interactive process (cron, launchd, anything not explicitly granted access) gets "Operation not permitted" touching it, regardless of which scheduler you use. Fix: System Settings → Privacy & Security → Full Disk Access → add `/bin/bash`.
</details>

<details>
<summary><code>make clean</code> wiped my data</summary>

`docker compose down -v --rmi local` removes the named Postgres volume — migrations, RLS setup, and every user/board are gone. There's no automatic offsite backup; run `npm run db:backup` first if you have data worth keeping (see [Configuration](#configuration) for where it's written).
</details>

<details>
<summary>Migrations fail after pulling <code>main</code></summary>

```bash
npm run db:migrate
```
If the schema has diverged locally and that doesn't resolve cleanly: `make clean && make up` (destroys local data — back up first).
</details>

---

## Roadmap

- [x] Board API, three-layer tree, event log, next-action resolver (see `docs/list.md` for the full phase-by-phase history)
- [x] Postgres RLS tenancy
- [x] Markdown import/export via `board-codec`
- [x] Handle + password login (PATs removed)
- [ ] Google / GitHub OAuth
- [ ] Scheduled offsite backups (script exists; scheduling needs a one-time macOS Full Disk Access grant — see Troubleshooting)
- [ ] Reserved ngrok domain (free-tier hostname currently rotates on restart)
- [ ] Decide the fate of `Board.parallelAllowed` (the "two `doing`" escape hatch — currently unused, pending a decision to drop it)

---

## Contributing

Personal project, not currently accepting external contributions.

---

## License

Dual-licensed under either [MIT](LICENSE-MIT) or [Apache License, Version 2.0](LICENSE-APACHE), at your option.
