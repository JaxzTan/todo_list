import type { Event, Prisma } from "@prisma/client";
import { withTenant } from "../db";
import { ConflictError, NotFoundError } from "../api/errors";
import { findBoardOrThrow } from "./service";
import { currentSessionId, emitEvent } from "./events";

const REVERTIBLE = new Set(["STATUS_CHANGED", "ATTR_SET", "NODE_REWORDED", "NODE_ADDED", "NODE_CUT"]);

/**
 * TR-20: revert emits a compensating event and sets revertedBy; nothing is
 * deleted, so undo is itself history. Only event types with a well-defined
 * inverse are supported — reverting a note, a blocker, or a session
 * boundary would have to invent a meaning that isn't in the TRD, so those
 * are rejected rather than guessed at.
 */
export async function revertEvent(userId: string, slug: string, eventId: string): Promise<Event> {
  return withTenant(userId, async (tx) => {
    const board = await findBoardOrThrow(tx, userId, slug);
    const event = await tx.event.findFirst({ where: { id: eventId, boardId: board.id } });
    if (!event) throw new NotFoundError(`no event ${eventId} on board "${slug}"`);
    if (event.revertedBy) throw new ConflictError(`event ${eventId} was already reverted`);
    if (!REVERTIBLE.has(event.type)) {
      throw new ConflictError(`event type ${event.type} can't be reverted`);
    }
    if (!event.nodeId) throw new ConflictError(`event ${eventId} has no node to revert`);

    const node = await tx.node.findFirst({ where: { id: event.nodeId, boardId: board.id } });
    if (!node) throw new NotFoundError(`node for event ${eventId} no longer exists`);

    const sessionId = await currentSessionId(tx, board.id);
    const payload = event.payload as Record<string, unknown>;
    let compensating: Event;

    switch (event.type) {
      case "STATUS_CHANGED": {
        const restoredStatus = payload.from as string;
        await tx.node.update({
          where: { id: node.id },
          data: { status: restoredStatus as never, statusAt: new Date() },
        });
        compensating = await emitEvent(tx, {
          boardId: board.id,
          sessionId,
          nodeId: node.id,
          type: "STATUS_CHANGED",
          payload: { from: node.status, to: restoredStatus, revertOf: event.id },
          source: "SYSTEM",
        });
        break;
      }
      case "NODE_REWORDED": {
        const restoredTitle = payload.from as string;
        await tx.node.update({ where: { id: node.id }, data: { title: restoredTitle } });
        compensating = await emitEvent(tx, {
          boardId: board.id,
          sessionId,
          nodeId: node.id,
          type: "NODE_REWORDED",
          payload: { from: node.title, to: restoredTitle, revertOf: event.id },
          source: "SYSTEM",
        });
        break;
      }
      case "ATTR_SET": {
        const data: Prisma.NodeUpdateInput = {};
        const restored: Record<string, Prisma.InputJsonValue | null> = {};
        for (const [field, change] of Object.entries(payload)) {
          const from = (change as { from: Prisma.InputJsonValue | null }).from;
          restored[field] = from;
          if (field === "due") (data as Record<string, unknown>).due = from ? new Date(from as string) : null;
          else (data as Record<string, unknown>)[field] = from;
        }
        await tx.node.update({ where: { id: node.id }, data });
        compensating = await emitEvent(tx, {
          boardId: board.id,
          sessionId,
          nodeId: node.id,
          type: "ATTR_SET",
          payload: { restored, revertOf: event.id },
          source: "SYSTEM",
        });
        break;
      }
      case "NODE_ADDED": {
        await tx.node.update({ where: { id: node.id }, data: { archivedAt: new Date() } });
        compensating = await emitEvent(tx, {
          boardId: board.id,
          sessionId,
          nodeId: node.id,
          type: "NODE_CUT",
          payload: { reason: "reverting the original add", revertOf: event.id },
          source: "SYSTEM",
        });
        break;
      }
      case "NODE_CUT": {
        await tx.node.update({ where: { id: node.id }, data: { archivedAt: null } });
        compensating = await emitEvent(tx, {
          boardId: board.id,
          sessionId,
          nodeId: node.id,
          type: "NODE_ADDED",
          payload: { reason: "reverting the cut", revertOf: event.id, restored: true },
          source: "SYSTEM",
        });
        break;
      }
      default:
        // Unreachable — guarded by the REVERTIBLE check above.
        throw new ConflictError(`event type ${event.type} can't be reverted`);
    }

    await tx.event.update({ where: { id: event.id }, data: { revertedBy: compensating.id } });
    return compensating;
  });
}
