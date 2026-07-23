import type { Board, Prisma } from "@prisma/client";
import { withTenant } from "../db";
import { NotFoundError } from "../api/errors";
import { numberMap } from "./tree";
import { resolveNextAction } from "./nextAction";
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

export interface BoardDetail {
  board: Board;
  nodes: Awaited<ReturnType<Prisma.TransactionClient["node"]["findMany"]>>;
  nextAction: ReturnType<typeof resolveNextAction>;
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
    return { board, nodes, nextAction: resolveNextAction(nodes), counts };
  });
}

export function serializeNode(node: { id: string }, allNodes: { id: string }[]) {
  const numbers = numberMap(allNodes as Parameters<typeof numberMap>[0]);
  return { id: node.id, number: numbers.get(node.id) ?? null };
}
