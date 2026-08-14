import { handleRouteError, readJson } from "@/lib/api/http";
import { loginSchema } from "@/lib/auth/schemas";
import { loginWithPassword } from "@/lib/auth/service";

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await readJson(request));
    const token = await loginWithPassword(input.handle, input.password);
    if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
    return Response.json({ token });
  } catch (err) {
    return handleRouteError(err);
  }
}
