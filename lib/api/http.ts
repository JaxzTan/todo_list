import { ZodError } from "zod";
import { UnauthorizedError } from "../auth/tenant";
import { ConflictError, NotFoundError } from "./errors";

/**
 * TR-16: a board the caller doesn't own returns 404, never 403 — a 403
 * would confirm the board exists under that slug for someone else.
 */
export function handleRouteError(err: unknown): Response {
  if (err instanceof UnauthorizedError) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (err instanceof NotFoundError) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (err instanceof ConflictError) {
    return Response.json({ error: "conflict", message: err.message }, { status: 409 });
  }
  if (err instanceof ZodError) {
    return Response.json(
      { error: "bad_request", issues: err.flatten() },
      { status: 400 },
    );
  }
  if (err instanceof SyntaxError) {
    return Response.json({ error: "bad_request", message: "invalid JSON body" }, { status: 400 });
  }
  console.error(err);
  return Response.json({ error: "internal_error" }, { status: 500 });
}

export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.trim() === "") return {};
  return JSON.parse(text);
}
