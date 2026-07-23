import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, withTenant } from "../db";

// TR-15 / TR-16: RLS has to catch exactly the query shape that bypasses a
// forgotten `WHERE` — a direct findUnique-by-id for a row owned by someone
// else — not just a scoped findMany. Every assertion below reaches for rows
// "by their own id", the shape the TRD calls out as the actual risk.

let userA: { id: string };
let userB: { id: string };

beforeAll(async () => {
  userA = await prisma.user.create({
    data: { handle: `rls-test-a-${randomUUID()}`, tokenHash: `unused-${randomUUID()}` },
  });
  userB = await prisma.user.create({
    data: { handle: `rls-test-b-${randomUUID()}`, tokenHash: `unused-${randomUUID()}` },
  });
});

afterAll(async () => {
  // Each user cleans up their own rows through their own tenant scope —
  // deliberately not relying on FK-cascade-through-RLS semantics, which
  // this test exists to be skeptical of in the first place.
  await withTenant(userA.id, (tx) => tx.board.deleteMany({ where: { ownerId: userA.id } }));
  await withTenant(userB.id, (tx) => tx.board.deleteMany({ where: { ownerId: userB.id } }));
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  await prisma.$disconnect();
});

describe("row-level security", () => {
  it("without a tenant set, queries see nothing rather than everything", async () => {
    // No withTenant wrapper — app.current_user_id is unset for this
    // connection. Default-deny is the safe failure mode; default-allow
    // would mean a forgotten withTenant call leaks every board.
    const boards = await prisma.board.findMany();
    expect(boards).toEqual([]);
  });

  it("a board is invisible to findMany under the other tenant's scope", async () => {
    const board = await withTenant(userA.id, (tx) =>
      tx.board.create({
        data: {
          ownerId: userA.id,
          slug: "rls-test-board",
          type: "PROJECT",
          title: "RLS test board",
          goal: "prove tenant isolation",
        },
      }),
    );

    const asOwner = await withTenant(userA.id, (tx) => tx.board.findMany());
    expect(asOwner.map((b) => b.id)).toContain(board.id);

    const asOther = await withTenant(userB.id, (tx) => tx.board.findMany());
    expect(asOther.map((b) => b.id)).not.toContain(board.id);
  });

  it("a board is invisible to a direct findUnique-by-id under the other tenant's scope (TR-16)", async () => {
    const board = await withTenant(userA.id, (tx) =>
      tx.board.create({
        data: {
          ownerId: userA.id,
          slug: "rls-test-board-direct",
          type: "PROJECT",
          title: "RLS direct-id test",
          goal: "prove id lookups don't bypass RLS",
        },
      }),
    );

    const asOwner = await withTenant(userA.id, (tx) =>
      tx.board.findUnique({ where: { id: board.id } }),
    );
    expect(asOwner?.id).toBe(board.id);

    const asOther = await withTenant(userB.id, (tx) =>
      tx.board.findUnique({ where: { id: board.id } }),
    );
    expect(asOther).toBeNull();
  });

  it("a child row (Node) is invisible by id across tenants even though it has no ownerId column of its own", async () => {
    const board = await withTenant(userA.id, (tx) =>
      tx.board.create({
        data: {
          ownerId: userA.id,
          slug: "rls-test-board-child",
          type: "PROJECT",
          title: "RLS child-row test",
          goal: "prove Node inherits tenancy through boardId",
        },
      }),
    );
    const node = await withTenant(userA.id, (tx) =>
      tx.node.create({
        data: { boardId: board.id, kind: "STEP", title: "a step", position: 1 },
      }),
    );

    const asOwner = await withTenant(userA.id, (tx) =>
      tx.node.findUnique({ where: { id: node.id } }),
    );
    expect(asOwner?.id).toBe(node.id);

    const asOther = await withTenant(userB.id, (tx) =>
      tx.node.findUnique({ where: { id: node.id } }),
    );
    expect(asOther).toBeNull();
  });

  it("global slug uniqueness would leak board existence across tenants, so it's scoped per-owner instead", async () => {
    // Both tenants can use the identical slug — @@unique([ownerId, slug]),
    // never a bare @@unique(slug). See docs/list.md decision context: a
    // globally unique slug would 409 the second user just for picking a
    // name the first user already has, disclosing that the board exists.
    await withTenant(userA.id, (tx) =>
      tx.board.create({
        data: {
          ownerId: userA.id,
          slug: "shared-name",
          type: "PROJECT",
          title: "A's board",
          goal: "goal",
        },
      }),
    );

    await expect(
      withTenant(userB.id, (tx) =>
        tx.board.create({
          data: {
            ownerId: userB.id,
            slug: "shared-name",
            type: "PROJECT",
            title: "B's board",
            goal: "goal",
          },
        }),
      ),
    ).resolves.toMatchObject({ slug: "shared-name" });
  });
});
