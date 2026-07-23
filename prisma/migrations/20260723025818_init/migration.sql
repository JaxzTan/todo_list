-- CreateEnum
CREATE TYPE "BoardType" AS ENUM ('PROJECT', 'DAY');

-- CreateEnum
CREATE TYPE "NodeKind" AS ENUM ('GROUP', 'STEP');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('todo', 'doing', 'stuck', 'done', 'skipped');

-- CreateEnum
CREATE TYPE "Prio" AS ENUM ('high', 'med', 'low');

-- CreateEnum
CREATE TYPE "Quadrant" AS ENUM ('do_now', 'schedule', 'delegate', 'drop');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('INFERRED', 'EXPLICIT', 'IMPORT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('NODE_ADDED', 'NODE_CUT', 'NODE_REWORDED', 'STATUS_CHANGED', 'ATTR_SET', 'NOTE_ADDED', 'BLOCKER_OPENED', 'BLOCKER_RESOLVED', 'SESSION_OPENED', 'SESSION_CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "BoardType" NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "dateKey" TEXT,
    "deadline" TIMESTAMP(3),
    "activeColumns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Node" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "parentId" TEXT,
    "kind" "NodeKind" NOT NULL,
    "title" TEXT NOT NULL,
    "doneCondition" TEXT,
    "position" INTEGER NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'todo',
    "statusAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due" TIMESTAMP(3),
    "prio" "Prio",
    "owner" TEXT,
    "quadrant" "Quadrant",
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "sessionId" TEXT,
    "nodeId" TEXT,
    "type" "EventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "source" "EventSource" NOT NULL DEFAULT 'INFERRED',
    "ambiguous" BOOLEAN NOT NULL DEFAULT false,
    "revertedBy" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blocker" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unblockPlan" TEXT,
    "openedEventId" TEXT NOT NULL,
    "resolvedEventId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Blocker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Import" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "sessionId" TEXT,
    "rawBody" TEXT NOT NULL,
    "unparsed" TEXT,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "bodyHash" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Import_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "User_tokenHash_key" ON "User"("tokenHash");

-- CreateIndex
CREATE INDEX "Board_ownerId_updatedAt_idx" ON "Board"("ownerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Board_ownerId_slug_key" ON "Board"("ownerId", "slug");

-- CreateIndex
CREATE INDEX "Node_boardId_parentId_position_idx" ON "Node"("boardId", "parentId", "position");

-- CreateIndex
CREATE INDEX "Node_boardId_status_idx" ON "Node"("boardId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Event_revertedBy_key" ON "Event"("revertedBy");

-- CreateIndex
CREATE INDEX "Event_boardId_at_idx" ON "Event"("boardId", "at");

-- CreateIndex
CREATE INDEX "Event_boardId_type_at_idx" ON "Event"("boardId", "type", "at");

-- CreateIndex
CREATE INDEX "Event_nodeId_at_idx" ON "Event"("nodeId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "Blocker_openedEventId_key" ON "Blocker"("openedEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Blocker_resolvedEventId_key" ON "Blocker"("resolvedEventId");

-- CreateIndex
CREATE INDEX "Blocker_boardId_resolvedAt_idx" ON "Blocker"("boardId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_boardId_seq_key" ON "Session"("boardId", "seq");

-- CreateIndex
CREATE INDEX "Import_boardId_createdAt_idx" ON "Import"("boardId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_boardId_sessionId_idx" ON "Report"("boardId", "sessionId");

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Node" ADD CONSTRAINT "Node_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Node" ADD CONSTRAINT "Node_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Import" ADD CONSTRAINT "Import_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TR-7: at most one `doing` step per board, enforced at the DB layer.
-- The FR-7 "two doing with a flag" escape hatch was dropped (see docs/list.md
-- decision #1, per the TRD's own recommendation), so this is a plain partial
-- unique index rather than a trigger that counts rows.
CREATE UNIQUE INDEX "Node_one_doing_per_board" ON "Node"("boardId") WHERE "status" = 'doing' AND "archivedAt" IS NULL;

-- TR-6 / TR-21: a Node can't be `stuck` without an open Blocker. Deferred so
-- the status UPDATE and the Blocker INSERT can happen in either order within
-- the same transaction and are only checked at COMMIT (TR-6's requirement
-- that the transition and its Blocker insert are structurally inseparable).
CREATE OR REPLACE FUNCTION check_stuck_has_open_blocker() RETURNS trigger AS $$
BEGIN
  IF NEW."status" = 'stuck' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "Blocker"
      WHERE "nodeId" = NEW."id" AND "resolvedAt" IS NULL
    ) THEN
      RAISE EXCEPTION 'Node % has status stuck but no open Blocker', NEW."id";
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER node_stuck_requires_blocker
  AFTER INSERT OR UPDATE OF "status" ON "Node"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION check_stuck_has_open_blocker();
