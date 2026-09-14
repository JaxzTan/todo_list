import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";
import { POST } from "./route";

let userId: string;
const HANDLE = `login-route-test-${randomUUID()}`;
const PASSWORD = "correct horse battery staple";

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      handle: HANDLE,
      passwordHash: await hashToken(PASSWORD),
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.authSession.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

function requestWith(body: unknown): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: body !== undefined ? { "content-type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/auth/login", () => {
  it("returns a bearer-usable token for the correct handle/password", async () => {
    const res = await POST(requestWith({ handle: HANDLE, password: PASSWORD }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };
    expect(typeof body.token).toBe("string");
    expect(body.token.length).toBeGreaterThan(0);
  });

  it("401s on the wrong password without leaking which field was wrong", async () => {
    const res = await POST(requestWith({ handle: HANDLE, password: "nope" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("401s on an unknown handle", async () => {
    const res = await POST(requestWith({ handle: `no-such-user-${randomUUID()}`, password: PASSWORD }));
    expect(res.status).toBe(401);
  });

  it("400s on a missing field", async () => {
    const res = await POST(requestWith({ handle: HANDLE }));
    expect(res.status).toBe(400);
  });

  it("400s on malformed JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      }),
    );
    expect(res.status).toBe(400);
  });
});
