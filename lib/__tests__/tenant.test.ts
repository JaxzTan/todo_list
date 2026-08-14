import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../db";
import { generateSessionToken, generateToken, hashToken } from "../auth/tokens";
import { extractBearerToken, requireUser, resolveUser, UnauthorizedError } from "../auth/tenant";
import { loginWithPassword } from "../auth/service";

let userId: string;
let token: string;

let passwordUserId: string;
const PASSWORD_HANDLE = `tenant-test-pw-${randomUUID()}`;
const PASSWORD = "correct horse battery staple";

beforeAll(async () => {
  token = generateToken();
  const user = await prisma.user.create({
    data: { handle: `tenant-test-${randomUUID()}`, tokenHash: await hashToken(token) },
  });
  userId = user.id;

  const passwordUser = await prisma.user.create({
    data: {
      handle: PASSWORD_HANDLE,
      tokenHash: await hashToken(generateToken()),
      passwordHash: await hashToken(PASSWORD),
    },
  });
  passwordUserId = passwordUser.id;
});

afterAll(async () => {
  await prisma.authSession.deleteMany({ where: { userId: { in: [userId, passwordUserId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, passwordUserId] } } });
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

describe("password login + AuthSession resolution", () => {
  it("loginWithPassword mints a session token that resolveUser accepts", async () => {
    const sessionToken = await loginWithPassword(PASSWORD_HANDLE, PASSWORD);
    expect(sessionToken).not.toBeNull();
    const user = await resolveUser(requestWith(`Bearer ${sessionToken}`));
    expect(user?.id).toBe(passwordUserId);
  });

  it("rejects the wrong password", async () => {
    expect(await loginWithPassword(PASSWORD_HANDLE, "wrong password")).toBeNull();
  });

  it("rejects an unknown handle", async () => {
    expect(await loginWithPassword(`no-such-user-${randomUUID()}`, PASSWORD)).toBeNull();
  });

  it("rejects a user that has no password set", async () => {
    const patOnlyUser = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await loginWithPassword(patOnlyUser.handle, "anything")).toBeNull();
  });

  it("resolveUser rejects an expired session token", async () => {
    const expiredToken = generateSessionToken();
    await prisma.authSession.create({
      data: {
        userId: passwordUserId,
        tokenHash: await hashToken(expiredToken),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    expect(await resolveUser(requestWith(`Bearer ${expiredToken}`))).toBeNull();
  });

  it("a fresh login replaces the previous session rather than accumulating rows", async () => {
    const first = await loginWithPassword(PASSWORD_HANDLE, PASSWORD);
    const second = await loginWithPassword(PASSWORD_HANDLE, PASSWORD);
    expect(await resolveUser(requestWith(`Bearer ${first}`))).toBeNull();
    expect((await resolveUser(requestWith(`Bearer ${second}`)))?.id).toBe(passwordUserId);
  });
});
