-- PATs are gone — password login (AuthSession) is the only credential.
-- DropIndex
DROP INDEX "User_tokenHash_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "tokenHash";
