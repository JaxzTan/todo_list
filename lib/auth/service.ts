import { prisma } from "../db";
import { generateSessionToken, hashToken, verifyToken } from "./tokens";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * resolveUser argon2-verifies every live session, so the count has to stay
 * bounded. A few per user covers the browser, a phone, and the assistant
 * (scripts/board-client.mts) without any of them logging the others out.
 */
export const MAX_SESSIONS_PER_USER = 3;

export async function loginWithPassword(handle: string, password: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { handle } });
  if (!user?.passwordHash) return null;
  if (!(await verifyToken(user.passwordHash, password))) return null;

  const token = generateSessionToken();
  const tokenHash = await hashToken(token);
  // Keep the newest live sessions and replace the rest (expired ones
  // included) with this one. A batch rather than an interactive transaction:
  // every round trip to Neon costs ~1s, and interactive transactions time out
  // at 5s.
  const kept = await prisma.authSession.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: MAX_SESSIONS_PER_USER - 1,
    select: { id: true },
  });
  await prisma.$transaction([
    prisma.authSession.deleteMany({ where: { userId: user.id, id: { notIn: kept.map((s) => s.id) } } }),
    prisma.authSession.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    }),
  ]);
  return token;
}
