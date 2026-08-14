import { prisma } from "../db";
import { generateSessionToken, hashToken, verifyToken } from "./tokens";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Only one active AuthSession per user — a fresh password login replaces
 * any prior one rather than accumulating rows, mirroring how a PAT is a
 * single credential per user rather than a growing set.
 */
export async function loginWithPassword(handle: string, password: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { handle } });
  if (!user?.passwordHash) return null;
  if (!(await verifyToken(user.passwordHash, password))) return null;

  const token = generateSessionToken();
  const tokenHash = await hashToken(token);
  await prisma.$transaction([
    prisma.authSession.deleteMany({ where: { userId: user.id } }),
    prisma.authSession.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    }),
  ]);
  return token;
}
