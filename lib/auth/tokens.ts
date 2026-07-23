import { randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

const TOKEN_PREFIX = "ebpat_"; // exec-board personal access token

export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

export function hashToken(token: string): Promise<string> {
  return hash(token);
}

export function verifyToken(tokenHash: string, token: string): Promise<boolean> {
  return verify(tokenHash, token);
}
