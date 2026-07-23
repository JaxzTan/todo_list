import { requireUser } from "@/lib/auth/tenant";
import { handleRouteError } from "@/lib/api/http";
import { rebuildBoardStatuses } from "@/lib/boards/rebuild";

// TR-22: not in the TRD's §5 endpoint table, but the rebuild job needs some
// trigger — this is the obvious place for it, alongside /events/:id/revert.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await requireUser(request);
    const { slug } = await params;
    const mismatches = await rebuildBoardStatuses(user.id, slug);
    return Response.json({ mismatches });
  } catch (err) {
    return handleRouteError(err);
  }
}
