import { requireUser } from "@/lib/auth/tenant";
import { handleRouteError } from "@/lib/api/http";
import { revertEvent } from "@/lib/boards/revert";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { slug, id } = await params;
    const compensating = await revertEvent(user.id, slug, id);
    return Response.json({ event: compensating });
  } catch (err) {
    return handleRouteError(err);
  }
}
