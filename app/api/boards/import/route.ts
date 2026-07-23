import { requireUser } from "@/lib/auth/tenant";
import { handleRouteError, readJson } from "@/lib/api/http";
import { importBoardSchema } from "@/lib/boards/schemas";
import { importBoardMarkdown } from "@/lib/boards/markdown";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const input = importBoardSchema.parse(await readJson(request));
    const result = await importBoardMarkdown(user.id, input.slug, input.markdown);
    return Response.json(result, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
