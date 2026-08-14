-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "visibleFields" TEXT[] DEFAULT ARRAY['due', 'prio', 'blocker']::TEXT[];

-- AlterTable
ALTER TABLE "Node" DROP COLUMN "quadrant";

-- DropEnum
DROP TYPE "Quadrant";
