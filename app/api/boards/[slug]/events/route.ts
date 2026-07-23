import { requireUser } from "@/lib/auth/tenant";
import { handleRouteError } from "@/lib/api/http";
import { withTenant } from "@/lib/db";
import { findBoardOrThrow } from "@/lib/boards/service";
import type { EventType } from "@prisma/client";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await requireUser(request);
    const { slug } = await params;
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId") ?? undefined;
    const type = (url.searchParams.get("type") as EventType | null) ?? undefined;

    const events = await withTenant(user.id, async (tx) => {
      const board = await findBoardOrThrow(tx, user.id, slug);
      return tx.event.findMany({
        where: { boardId: board.id, sessionId, type },
        orderBy: { at: "desc" },
      });
    });

    return Response.json({ events });
  } catch (err) {
    return handleRouteError(err);
  }
}
