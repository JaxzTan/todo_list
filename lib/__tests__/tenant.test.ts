import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../db";
import { generateSessionToken, hashToken } from "../auth/tokens";
import { extractBearerToken, requireUser, resolveUser, UnauthorizedError } from "../auth/tenant";
import { loginWithPassword, MAX_SESSIONS_PER_USER } from "../auth/service";

let noPasswordUserId: string;
let passwordUserId: string;
const PASSWORD_HANDLE = `tenant-test-pw-${randomUUID()}`;
const PASSWORD = "correct horse battery staple";

beforeAll(async () => {
  const noPasswordUser = await prisma.user.create({ data: { handle: `tenant-test-${randomUUID()}` } });
  noPasswordUserId = noPasswordUser.id;

  const passwordUser = await prisma.user.create({
    data: { handle: PASSWORD_HANDLE, passwordHash: await hashToken(PASSWORD) },
  });
  passwordUserId = passwordUser.id;
});

afterAll(async () => {
  await prisma.authSession.deleteMany({ where: { userId: { in: [noPasswordUserId, passwordUserId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [noPasswordUserId, passwordUserId] } } });
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
  it("resolves the correct user for a valid session token", async () => {
    const token = await loginWithPassword(PASSWORD_HANDLE, PASSWORD);
    const user = await resolveUser(requestWith(`Bearer ${token}`));
    expect(user?.id).toBe(passwordUserId);
  });

  it("resolves nothing for a well-formed but wrong token", async () => {
    const user = await resolveUser(requestWith(`Bearer ${generateSessionToken()}`));
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
    const token = await loginWithPassword(PASSWORD_HANDLE, PASSWORD);
    const user = await requireUser(requestWith(`Bearer ${token}`));
    expect(user.id).toBe(passwordUserId);
  });
});

describe("password login + AuthSession", () => {
  it("rejects the wrong password", async () => {
    expect(await loginWithPassword(PASSWORD_HANDLE, "wrong password")).toBeNull();
  });

  it("rejects an unknown handle", async () => {
    expect(await loginWithPassword(`no-such-user-${randomUUID()}`, PASSWORD)).toBeNull();
  });

  it("rejects a user that has no password set", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: noPasswordUserId } });
    expect(await loginWithPassword(user.handle, "anything")).toBeNull();
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

  it("a second login doesn't log out the first (browser + assistant side by side)", async () => {
    const first = await loginWithPassword(PASSWORD_HANDLE, PASSWORD);
    const second = await loginWithPassword(PASSWORD_HANDLE, PASSWORD);
    expect((await resolveUser(requestWith(`Bearer ${first}`)))?.id).toBe(passwordUserId);
    expect((await resolveUser(requestWith(`Bearer ${second}`)))?.id).toBe(passwordUserId);
  }, 30_000); // several logins, each a few Neon round trips

  it(`keeps at most ${MAX_SESSIONS_PER_USER} sessions, dropping the oldest`, async () => {
    const tokens: (string | null)[] = [];
    for (let i = 0; i <= MAX_SESSIONS_PER_USER; i++) tokens.push(await loginWithPassword(PASSWORD_HANDLE, PASSWORD));
    expect(await prisma.authSession.count({ where: { userId: passwordUserId } })).toBe(MAX_SESSIONS_PER_USER);
    expect(await resolveUser(requestWith(`Bearer ${tokens[0]}`))).toBeNull();
    expect((await resolveUser(requestWith(`Bearer ${tokens.at(-1)}`)))?.id).toBe(passwordUserId);
  }, 30_000);
});
