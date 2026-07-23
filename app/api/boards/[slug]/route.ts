import { requireUser } from "@/lib/auth/tenant";
import { handleRouteError } from "@/lib/api/http";
import { getBoardDetail } from "@/lib/boards/service";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await requireUser(request);
    const { slug } = await params;
    const { board, nodes, nextAction, counts } = await getBoardDetail(user.id, slug);
    return Response.json({ board, nodes, nextAction, counts });
  } catch (err) {
    return handleRouteError(err);
  }
}
