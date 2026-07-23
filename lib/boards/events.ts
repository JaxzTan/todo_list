import type { EventSource, EventType, Prisma } from "@prisma/client";

export async function emitEvent(
  tx: Prisma.TransactionClient,
  params: {
    boardId: string;
    sessionId?: string | null;
    nodeId?: string | null;
    type: EventType;
    payload: Prisma.InputJsonValue;
    source?: EventSource;
    ambiguous?: boolean;
  },
) {
  return tx.event.create({
    data: {
      boardId: params.boardId,
      sessionId: params.sessionId ?? null,
      nodeId: params.nodeId ?? null,
      type: params.type,
      payload: params.payload,
      source: params.source ?? "EXPLICIT",
      ambiguous: params.ambiguous ?? false,
    },
  });
}

/**
 * The open (unclosed) session for a board, if any — mutations attach to it
 * so FR-15's report can group events by session. Not an error if there
 * isn't one; callers just log the event with sessionId: null.
 */
export async function currentSessionId(
  tx: Prisma.TransactionClient,
  boardId: string,
): Promise<string | null> {
  const session = await tx.session.findFirst({
    where: { boardId, endedAt: null },
    orderBy: { seq: "desc" },
  });
  return session?.id ?? null;
}
