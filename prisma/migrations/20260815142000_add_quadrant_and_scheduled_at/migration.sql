-- CreateEnum
CREATE TYPE "Quadrant" AS ENUM ('do_now', 'schedule', 'delegate', 'drop');

-- AlterTable
ALTER TABLE "Node" ADD COLUMN     "quadrant" "Quadrant",
ADD COLUMN     "scheduledAt" TIMESTAMP(3);
