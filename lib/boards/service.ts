import type { Board, Prisma } from "@prisma/client";
import { withTenant } from "../db";
import { NotFoundError } from "../api/errors";
import { numberMap } from "./tree";
import { rankCandidates } from "./nextAction";
import type { CreateBoardInput } from "./schemas";

export async function findBoardOrThrow(
  tx: Prisma.TransactionClient,
  ownerId: string,
  slug: string,
): Promise<Board> {
  const board = await tx.board.findFirst({ where: { ownerId, slug } });
  if (!board) throw new NotFoundError(`no board with slug "${slug}"`);
  return board;
}

export function listBoards(userId: string) {
  return withTenant(userId, (tx) =>
    tx.board.findMany({ where: { ownerId: userId }, orderBy: { updatedAt: "desc" } }),
  );
}

export function createBoard(userId: string, input: CreateBoardInput) {
  return withTenant(userId, (tx) =>
    tx.board.create({
      data: {
        ownerId: userId,
        slug: input.slug,
        type: input.type,
        title: input.title,
        goal: input.goal,
        dateKey: input.dateKey ?? null,
        deadline: input.deadline ? new Date(`${input.deadline}T00:00:00.000Z`) : null,
      },
    }),
  );
}

export async function deleteBoard(userId: string, slug: string): Promise<void> {
  await withTenant(userId, async (tx) => {
    const board = await findBoardOrThrow(tx, userId, slug);
    // Every child relation (nodes, events, sessions, imports, reports) is
    // `onDelete: Cascade` on Board, so removing the row removes the board's
    // entire subtree in one statement.
    await tx.board.delete({ where: { id: board.id } });
  });
}

export interface BoardDetail {
  board: Board;
  nodes: Awaited<ReturnType<Prisma.TransactionClient["node"]["findMany"]>>;
  nextAction: ReturnType<typeof rankCandidates>[number] | null;
  // Runners-up after the next action — backs the "Then, probably" panel.
  candidates: ReturnType<typeof rankCandidates>;
  // Open blockers by node id — backs the inline blocker-reason row in the
  // tree view (the wireframe's Fields "Blocker reason" column).
  blockers: { nodeId: string; description: string }[];
  counts: { done: number; total: number };
}

export async function getBoardDetail(userId: string, slug: string): Promise<BoardDetail> {
  return withTenant(userId, async (tx) => {
    const board = await findBoardOrThrow(tx, userId, slug);
    const nodes = await tx.node.findMany({
      where: { boardId: board.id, archivedAt: null },
      orderBy: [{ parentId: "asc" }, { position: "asc" }],
    });
    const steps = nodes.filter((n) => n.kind === "STEP");
    const counts = {
      done: steps.filter((n) => n.status === "done" || n.status === "skipped").length,
      total: steps.length,
    };
    const ranked = rankCandidates(nodes);
    const openBlockers = await tx.blocker.findMany({
      where: { boardId: board.id, resolvedAt: null },
      select: { nodeId: true, description: true },
    });
    return {
      board,
      nodes,
      nextAction: ranked[0] ?? null,
      candidates: ranked.slice(1, 4),
      blockers: openBlockers,
      counts,
    };
  });
}

export function updateBoard(userId: string, slug: string, input: { visibleFields?: string[] }) {
  return withTenant(userId, async (tx) => {
    const board = await findBoardOrThrow(tx, userId, slug);
    return tx.board.update({
      where: { id: board.id },
      data: {
        ...(input.visibleFields !== undefined ? { visibleFields: input.visibleFields } : {}),
      },
    });
  });
}

export function serializeNode(node: { id: string }, allNodes: { id: string }[]) {
  const numbers = numberMap(allNodes as Parameters<typeof numberMap>[0]);
  return { id: node.id, number: numbers.get(node.id) ?? null };
}
