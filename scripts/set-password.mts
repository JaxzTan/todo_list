// Standalone CLI, run directly with Node's native TypeScript support:
//   node scripts/set-password.mts <handle> <password>
// Sets/rotates the given user's password (upserts the user if they don't
// exist yet, same as issue-token.mts). No self-serve signup — this mirrors
// how PATs are issued, an operator-run command rather than a public form.
import { hash } from "@node-rs/argon2";
import { prisma } from "../lib/db.ts";
import { generateToken, hashToken } from "../lib/auth/tokens.ts";

const handle = process.argv[2];
const password = process.argv[3];
if (!handle || !password) {
  console.error("Usage: node scripts/set-password.mts <handle> <password>");
  process.exit(1);
}

const passwordHash = await hash(password);

const user = await prisma.user.findUnique({ where: { handle } });
if (user) {
  await prisma.user.update({ where: { handle }, data: { passwordHash } });
  console.log(`Password set for existing user: ${handle} (${user.id})`);
} else {
  const token = generateToken();
  const created = await prisma.user.create({
    data: { handle, tokenHash: await hashToken(token), passwordHash },
  });
  console.log(`Created user: ${handle} (${created.id})`);
  console.log(`Also issued a PAT (save this now — it will not be shown again):`);
  console.log(token);
}

await prisma.$disconnect();
