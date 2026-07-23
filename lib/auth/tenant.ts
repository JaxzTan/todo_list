import type { User } from "@prisma/client";
import { prisma } from "../db";
import { verifyToken } from "./tokens";

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1]!.trim() : null;
}

/**
 * TR-14: a bearer token resolves to exactly one User before any tenant-
 * scoped query runs. Argon2 hashes are salted, so lookup can't be an
 * indexed `WHERE tokenHash = hash(token)` — with only two users (the
 * TRD's own design constraint), verifying against each stored hash is the
 * correct approach here, not a shortcut taken to avoid one.
 */
export async function resolveUser(request: Request): Promise<User | null> {
  const token = extractBearerToken(request);
  if (!token) return null;

  const users = await prisma.user.findMany();
  for (const user of users) {
    try {
      if (await verifyToken(user.tokenHash, token)) {
        return user;
      }
    } catch {
      // A malformed tokenHash on one row (bad data, mid-rotation, etc.)
      // must not break resolution for every other user — treat it as a
      // non-match rather than letting argon2's parse error propagate.
    }
  }
  return null;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function requireUser(request: Request): Promise<User> {
  const user = await resolveUser(request);
  if (!user) throw new UnauthorizedError();
  return user;
}
