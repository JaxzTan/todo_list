import { requireUser } from "@/lib/auth/tenant";
import { handleRouteError, readJson } from "@/lib/api/http";
import { patchNodeSchema } from "@/lib/boards/schemas";
import { patchNode } from "@/lib/boards/mutations";
import { getBoardDetail } from "@/lib/boards/service";
import { numberMap } from "@/lib/boards/tree";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; nodeId: string }> },
) {
  try {
    const user = await requireUser(request);
    const { slug, nodeId } = await params;
    const input = patchNodeSchema.parse(await readJson(request));
    const updated = await patchNode(user.id, slug, nodeId, input);

    const { nodes, nextAction, counts } = await getBoardDetail(user.id, slug);
    const numbers = numberMap(nodes);

    return Response.json({
      node: { id: updated.id, number: numbers.get(updated.id) ?? null, status: updated.status },
      nextAction,
      counts,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
