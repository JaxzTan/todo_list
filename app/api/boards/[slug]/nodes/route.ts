import { requireUser } from "@/lib/auth/tenant";
import { handleRouteError, readJson } from "@/lib/api/http";
import { addNodeSchema } from "@/lib/boards/schemas";
import { addNode } from "@/lib/boards/mutations";
import { getBoardDetail } from "@/lib/boards/service";
import { numberMap } from "@/lib/boards/tree";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await requireUser(request);
    const { slug } = await params;
    const input = addNodeSchema.parse(await readJson(request));
    const created = await addNode(user.id, slug, input);

    const { nodes, nextAction, counts } = await getBoardDetail(user.id, slug);
    const numbers = numberMap(nodes);

    return Response.json(
      {
        node: { id: created.id, number: numbers.get(created.id) ?? null },
        nextAction,
        counts,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
