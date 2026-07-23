import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../db";
import { generateToken, hashToken } from "../auth/tokens";
import { extractBearerToken, requireUser, resolveUser, UnauthorizedError } from "../auth/tenant";

let userId: string;
let token: string;

beforeAll(async () => {
  token = generateToken();
  const user = await prisma.user.create({
    data: { handle: `tenant-test-${randomUUID()}`, tokenHash: await hashToken(token) },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

function requestWith(header: string | null): Request {
  const headers = new Headers();
  if (header !== null) headers.set("authorization", header);
  return new Request("http://localhost/api/test", { headers });
}

describe("extractBearerToken", () => {
  it("reads the token out of a well-formed header", () => {
    expect(extractBearerToken(requestWith("Bearer abc123"))).toBe("abc123");
  });

  it("is case-insensitive on the scheme and tolerates extra whitespace", () => {
    expect(extractBearerToken(requestWith("bearer   abc123  "))).toBe("abc123");
  });

  it("returns null when there is no header, or the scheme is wrong", () => {
    expect(extractBearerToken(requestWith(null))).toBeNull();
    expect(extractBearerToken(requestWith("Basic abc123"))).toBeNull();
  });
});

describe("resolveUser / requireUser (TR-14)", () => {
  it("resolves the correct user for a valid token", async () => {
    const user = await resolveUser(requestWith(`Bearer ${token}`));
    expect(user?.id).toBe(userId);
  });

  it("resolves nothing for a well-formed but wrong token", async () => {
    const user = await resolveUser(requestWith(`Bearer ${generateToken()}`));
    expect(user).toBeNull();
  });

  it("resolves nothing when there's no Authorization header at all", async () => {
    const user = await resolveUser(requestWith(null));
    expect(user).toBeNull();
  });

  it("requireUser throws UnauthorizedError instead of returning null", async () => {
    await expect(requireUser(requestWith(null))).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("requireUser resolves for a valid token", async () => {
    const user = await requireUser(requestWith(`Bearer ${token}`));
    expect(user.id).toBe(userId);
  });
});
