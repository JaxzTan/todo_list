import { randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

const SESSION_TOKEN_PREFIX = "ebsess_"; // session token (password login)

/** Minted on a successful password login (lib/auth/service.ts). */
export function generateSessionToken(): string {
  return SESSION_TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

export function hashToken(token: string): Promise<string> {
  return hash(token);
}

export function verifyToken(tokenHash: string, token: string): Promise<boolean> {
  return verify(tokenHash, token);
}
