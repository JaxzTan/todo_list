import type { Session } from "@prisma/client";
import { withTenant } from "../db";
import { ConflictError } from "../api/errors";
import { findBoardOrThrow } from "./service";
import { emitEvent } from "./events";
import type { SessionActionInput } from "./schemas";

/**
 * FR-5: re-uploading/resuming a board increments `sessions`. "open" starts
 * a new one (closing any still-open session first, in case the previous
 * one never got an explicit "close" — e.g. the process died mid-session);
 * "close" ends the current one.
 */
export async function openOrCloseSession(
  userId: string,
  slug: string,
  input: SessionActionInput,
): Promise<Session> {
  return withTenant(userId, async (tx) => {
    const board = await findBoardOrThrow(tx, userId, slug);
    const open = await tx.session.findFirst({
      where: { boardId: board.id, endedAt: null },
      orderBy: { seq: "desc" },
    });

    if (input.action === "open") {
      if (open) {
        await tx.session.update({ where: { id: open.id }, data: { endedAt: new Date() } });
        await emitEvent(tx, {
          boardId: board.id,
          sessionId: open.id,
          type: "SESSION_CLOSED",
          payload: { auto: true, reason: "superseded by a new session" },
          source: "SYSTEM",
        });
      }
      const last = await tx.session.findFirst({ where: { boardId: board.id }, orderBy: { seq: "desc" } });
      const session = await tx.session.create({
        data: { boardId: board.id, seq: (last?.seq ?? 0) + 1 },
      });
      await emitEvent(tx, {
        boardId: board.id,
        sessionId: session.id,
        type: "SESSION_OPENED",
        payload: { seq: session.seq },
      });
      return session;
    }

    if (!open) throw new ConflictError("no open session on this board");
    const closed = await tx.session.update({ where: { id: open.id }, data: { endedAt: new Date() } });
    await emitEvent(tx, {
      boardId: board.id,
      sessionId: closed.id,
      type: "SESSION_CLOSED",
      payload: { seq: closed.seq },
    });
    return closed;
  });
}
