import { requireUser } from "@/lib/auth/tenant";
import { handleRouteError } from "@/lib/api/http";
import { generateReport } from "@/lib/boards/report";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await requireUser(request);
    const { slug } = await params;
    const report = await generateReport(user.id, slug);
    return Response.json({ report });
  } catch (err) {
    return handleRouteError(err);
  }
}
