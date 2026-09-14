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
 * scoped query runs. The only bearer credential is a password-login
 * AuthSession token (lib/auth/service.ts). Argon2 hashes are salted, so
 * lookup can't be an indexed `WHERE tokenHash = hash(token)` — sessions are
 * capped per user (MAX_SESSIONS_PER_USER), so verifying each live one is
 * bounded.
 */
export async function resolveUser(request: Request): Promise<User | null> {
  const token = extractBearerToken(request);
  if (!token) return null;
  const sessions = await prisma.authSession.findMany({
    where: { expiresAt: { gt: new Date() } },
    include: { user: true },
  });
  for (const session of sessions) {
    try {
      if (await verifyToken(session.tokenHash, token)) {
        return session.user;
      }
    } catch {
      // A malformed tokenHash on one row must not break resolution for
      // every other session — treat it as a non-match rather than letting
      // argon2's parse error propagate.
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
