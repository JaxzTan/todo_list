import { requireUser } from "@/lib/auth/tenant";
import { handleRouteError, readJson } from "@/lib/api/http";
import { createBoardSchema } from "@/lib/boards/schemas";
import { createBoard, listBoards } from "@/lib/boards/service";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const boards = await listBoards(user.id);
    return Response.json({ boards });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const input = createBoardSchema.parse(await readJson(request));
    const board = await createBoard(user.id, input);
    return Response.json({ board }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
