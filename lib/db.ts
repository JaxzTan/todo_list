import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var __execBoardPrisma: PrismaClient | undefined;
}

const appDatabaseUrl = process.env.APP_DATABASE_URL;
if (!appDatabaseUrl) {
  throw new Error(
    "APP_DATABASE_URL is not set. The app must never connect to Postgres as " +
      "the superuser (DATABASE_URL) at runtime — RLS (TR-15) silently does " +
      "nothing for superuser connections, so that would defeat tenancy.",
  );
}

const adapter = new PrismaPg({ connectionString: appDatabaseUrl });

export const prisma = globalThis.__execBoardPrisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.__execBoardPrisma = prisma;
}

/**
 * The only way route handlers may touch tenant-scoped tables. Sets the RLS
 * session variable and the query inside the same transaction, so there's no
 * window where a query could run before the scope is set (TR-15).
 */
export function withTenant<T>(
  userId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    return fn(tx);
  });
}
