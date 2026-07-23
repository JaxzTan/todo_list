import { requireUser } from "@/lib/auth/tenant";
import { handleRouteError } from "@/lib/api/http";
import { exportBoardMarkdown } from "@/lib/boards/markdown";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await requireUser(request);
    const { slug } = await params;
    const markdown = await exportBoardMarkdown(user.id, slug);
    return new Response(markdown, {
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
