// Standalone CLI, run directly with Node's native TypeScript support:
//   node scripts/issue-token.mts <handle>
// Creates the user if they don't exist yet, issues a fresh PAT, and prints
// it once (TR-17 — the raw token is never stored and never recoverable
// after this). Uses relative imports rather than the "@/" alias since this
// runs outside Next.js's bundler.
import { prisma } from "../lib/db.ts";
import { generateToken, hashToken } from "../lib/auth/tokens.ts";

const handle = process.argv[2];
if (!handle) {
  console.error("Usage: node scripts/issue-token.mts <handle>");
  process.exit(1);
}

const token = generateToken();
const tokenHash = await hashToken(token);

const user = await prisma.user.upsert({
  where: { handle },
  create: { handle, tokenHash },
  update: { tokenHash },
});

console.log(`User: ${user.handle} (${user.id})`);
console.log(`Token (save this now — it will not be shown again):`);
console.log(token);

await prisma.$disconnect();
