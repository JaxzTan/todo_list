import { requireUser } from "@/lib/auth/tenant";
import { handleRouteError, readJson } from "@/lib/api/http";
import { sessionActionSchema } from "@/lib/boards/schemas";
import { openOrCloseSession } from "@/lib/boards/sessions";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await requireUser(request);
    const { slug } = await params;
    const input = sessionActionSchema.parse(await readJson(request));
    const session = await openOrCloseSession(user.id, slug, input);
    return Response.json({ session });
  } catch (err) {
    return handleRouteError(err);
  }
}
