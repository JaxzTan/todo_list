// Standalone CLI, run directly with Node's native TypeScript support:
//   node --env-file=.env scripts/set-password.mts <handle> <password>
//   node --env-file=.env scripts/set-password.mts --from-env
// Sets/rotates a user's password, creating the user if they don't exist
// yet. `--from-env` applies every USER<n>/PASSWORD<n> pair in the
// environment (USER1/PASSWORD1, USER2/PASSWORD2, ...). No self-serve signup —
// accounts are operator-issued. Uses relative imports rather than the "@/"
// alias since this runs outside Next.js's bundler.
import { hash } from "@node-rs/argon2";
import { prisma } from "../lib/db.ts";

function pairsFromEnv(): [string, string][] {
  const pairs: [string, string][] = [];
  for (let n = 1; process.env[`USER${n}`] && process.env[`PASSWORD${n}`]; n++) {
    pairs.push([process.env[`USER${n}`]!, process.env[`PASSWORD${n}`]!]);
  }
  return pairs;
}

const [arg1, arg2] = process.argv.slice(2);
const pairs: [string, string][] = arg1 === "--from-env" ? pairsFromEnv() : arg1 && arg2 ? [[arg1, arg2]] : [];
if (pairs.length === 0) {
  console.error("Usage: node --env-file=.env scripts/set-password.mts <handle> <password> | --from-env");
  process.exit(1);
}

for (const [handle, password] of pairs) {
  const passwordHash = await hash(password);
  const existed = await prisma.user.findUnique({ where: { handle } });
  const user = await prisma.user.upsert({
    where: { handle },
    create: { handle, passwordHash },
    update: { passwordHash },
  });
  console.log(`${existed ? "Password set for existing user" : "Created user"}: ${user.handle} (${user.id})`);
}

await prisma.$disconnect();
