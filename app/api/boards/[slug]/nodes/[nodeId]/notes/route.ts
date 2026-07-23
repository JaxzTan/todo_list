import { requireUser } from "@/lib/auth/tenant";
import { handleRouteError, readJson } from "@/lib/api/http";
import { addNoteSchema } from "@/lib/boards/schemas";
import { addNote } from "@/lib/boards/mutations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; nodeId: string }> },
) {
  try {
    const user = await requireUser(request);
    const { slug, nodeId } = await params;
    const input = addNoteSchema.parse(await readJson(request));
    const event = await addNote(user.id, slug, nodeId, input);
    return Response.json({ event }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
