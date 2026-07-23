import { prisma } from "@/lib/db";

// §8: doubles as the skill client's reachability probe (TR-12) — it
// decides between API mode and local file mode before any write, so this
// has to prove the DB is actually reachable, not just that Next.js is up.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
