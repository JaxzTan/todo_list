#!/usr/bin/env node
// The Claude skill's thin client (TRD §2). Talks to the Board API over
// HTTP; when the API is unreachable, falls back to a local markdown file
// under .exec-board/ (TR-12) — that file uses the same board-codec grammar
// the API exports, so it's meant to be read and edited directly (with the
// normal file tools) while offline, not through a parallel offline-command
// surface. `sync` imports it back as soon as the API is reachable again.
//
// Usage: node --env-file=.env scripts/board-client.mts <command> [args...]
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const LOCAL_DIR = process.env.EXEC_BOARD_LOCAL_DIR ?? ".exec-board";
const TOKEN = process.env.EXEC_BOARD_TOKEN;

// §8 resolver indirection: if the base URL isn't set explicitly, fall back
// to whatever scripts/start-tunnel.sh last wrote — this is what makes the
// free (non-reserved-domain) ngrok tunnel usable despite the hostname
// rotating on every restart.
function resolveBaseUrl(): string {
  if (process.env.EXEC_BOARD_BASE_URL) return process.env.EXEC_BOARD_BASE_URL;
  try {
    return readFileSync(path.join(LOCAL_DIR, "tunnel-url.txt"), "utf-8").trim();
  } catch {
    return "http://localhost:3000";
  }
}
const BASE_URL = resolveBaseUrl();

function localPath(slug: string): string {
  return path.join(LOCAL_DIR, `${slug}.md`);
}

async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok: boolean };
    return body.ok === true;
  } catch {
    return false;
  }
}

async function api(method: string, urlPath: string, body?: unknown): Promise<unknown> {
  if (!TOKEN) {
    throw new Error("EXEC_BOARD_TOKEN is not set — issue one with scripts/issue-token.mts");
  }
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const isMarkdown = res.headers.get("content-type")?.includes("text/markdown");
  const payload = isMarkdown ? await res.text() : await res.json();
  if (!res.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? JSON.stringify(payload)
        : String(payload);
    throw new Error(`${method} ${urlPath} -> ${res.status}: ${message}`);
  }
  return payload;
}

function output(data: unknown) {
  if (typeof data === "string") {
    process.stdout.write(data.endsWith("\n") ? data : data + "\n");
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

function requireArg(args: string[], index: number, name: string): string {
  const value = args[index];
  if (!value) throw new Error(`missing argument: ${name}`);
  return value;
}

async function cmdHealth() {
  const healthy = await checkHealth();
  output({ ok: healthy, mode: healthy ? "api" : "local", baseUrl: BASE_URL });
}

/** Refresh (or create) the local cache from the API. Read-only against the DB. */
async function cmdPull(args: string[]) {
  const slug = requireArg(args, 0, "slug");
  if (!(await checkHealth())) {
    const existing = await readFile(localPath(slug), "utf-8").catch(() => null);
    if (existing === null) {
      throw new Error(
        `API unreachable and no local copy at ${localPath(slug)} — nothing to resume from`,
      );
    }
    output({ mode: "local", path: localPath(slug), markdown: existing });
    return;
  }
  const markdown = (await api("GET", `/api/boards/${slug}/markdown`)) as string;
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(localPath(slug), markdown, "utf-8");
  output({ mode: "api", path: localPath(slug), markdown });
}

/** Import the local file back into the API as a new revision (TR-12). */
async function cmdSync(args: string[]) {
  const slug = requireArg(args, 0, "slug");
  if (!(await checkHealth())) {
    throw new Error("API still unreachable — nothing to sync yet");
  }
  const markdown = await readFile(localPath(slug), "utf-8").catch(() => {
    throw new Error(`no local file at ${localPath(slug)} to sync`);
  });
  const result = await api("POST", "/api/boards/import", { slug, markdown });
  output(result);
}

async function cmdStatus(args: string[]) {
  const slug = requireArg(args, 0, "slug");
  output(await api("GET", `/api/boards/${slug}`));
}

async function cmdListBoards() {
  output(await api("GET", "/api/boards"));
}

async function cmdCreateBoard(args: string[]) {
  const [slug, type, title, goal] = args;
  if (!slug || !type || !title || !goal) {
    throw new Error("usage: create-board <slug> <PROJECT|DAY> <title> <goal>");
  }
  output(await api("POST", "/api/boards", { slug, type, title, goal }));
}

async function cmdAddNode(args: string[]) {
  const slug = requireArg(args, 0, "slug");
  const kind = requireArg(args, 1, "kind (GROUP|STEP)");
  const title = requireArg(args, 2, "title");
  const parentId = args[3] || undefined;
  output(await api("POST", `/api/boards/${slug}/nodes`, { kind, title, parentId }));
}

async function cmdPatchNode(args: string[]) {
  const slug = requireArg(args, 0, "slug");
  const nodeId = requireArg(args, 1, "nodeId");
  const patchJson = requireArg(args, 2, "patch JSON, e.g. '{\"status\":\"done\"}'");
  output(await api("PATCH", `/api/boards/${slug}/nodes/${nodeId}`, JSON.parse(patchJson)));
}

async function cmdAddNote(args: string[]) {
  const slug = requireArg(args, 0, "slug");
  const nodeId = requireArg(args, 1, "nodeId");
  const body = requireArg(args, 2, "note body");
  output(await api("POST", `/api/boards/${slug}/nodes/${nodeId}/notes`, { body }));
}

async function cmdSession(args: string[]) {
  const slug = requireArg(args, 0, "slug");
  const action = requireArg(args, 1, "open|close");
  output(await api("POST", `/api/boards/${slug}/sessions`, { action }));
}

async function cmdReport(args: string[]) {
  const slug = requireArg(args, 0, "slug");
  output(await api("GET", `/api/boards/${slug}/report`));
}

async function cmdRevert(args: string[]) {
  const slug = requireArg(args, 0, "slug");
  const eventId = requireArg(args, 1, "eventId");
  output(await api("POST", `/api/boards/${slug}/events/${eventId}/revert`));
}

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  health: cmdHealth,
  pull: cmdPull,
  sync: cmdSync,
  status: cmdStatus,
  "list-boards": cmdListBoards,
  "create-board": cmdCreateBoard,
  "add-node": cmdAddNode,
  "patch-node": cmdPatchNode,
  "add-note": cmdAddNote,
  session: cmdSession,
  report: cmdReport,
  revert: cmdRevert,
};

const [, , command, ...rest] = process.argv;
const handler = command ? COMMANDS[command] : undefined;
if (!handler) {
  console.error(`Usage: board-client.mts <${Object.keys(COMMANDS).join("|")}> [args...]`);
  process.exit(1);
}

try {
  await handler(rest);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
