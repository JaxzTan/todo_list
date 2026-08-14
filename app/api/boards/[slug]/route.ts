import { requireUser } from "@/lib/auth/tenant";
import { handleRouteError, readJson } from "@/lib/api/http";
import { deleteBoard, getBoardDetail, updateBoard } from "@/lib/boards/service";
import { updateBoardSchema } from "@/lib/boards/schemas";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await requireUser(request);
    const { slug } = await params;
    const { board, nodes, nextAction, candidates, blockers, counts } = await getBoardDetail(user.id, slug);
    return Response.json({ board, nodes, nextAction, candidates, blockers, counts });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await requireUser(request);
    const { slug } = await params;
    const input = updateBoardSchema.parse(await readJson(request));
    const board = await updateBoard(user.id, slug, input);
    return Response.json({ board });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await requireUser(request);
    const { slug } = await params;
    await deleteBoard(user.id, slug);
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
