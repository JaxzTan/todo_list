import { randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

const TOKEN_PREFIX = "ebpat_"; // exec-board personal access token
const SESSION_TOKEN_PREFIX = "ebsess_"; // exec-board session token (password login)

export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

/**
 * Minted on a successful password login (lib/auth/service.ts). Kept
 * separate from the PAT so logging in with a password never rotates or
 * invalidates the PAT that scripts/board-client.mts relies on — the PAT's
 * argon2 hash can't be reversed to hand back on a password login anyway.
 */
export function generateSessionToken(): string {
  return SESSION_TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

export function hashToken(token: string): Promise<string> {
  return hash(token);
}

export function verifyToken(tokenHash: string, token: string): Promise<boolean> {
  return verify(tokenHash, token);
}
