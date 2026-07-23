-- TR-15: Postgres RLS on every board-scoped table, keyed on a per-transaction
-- session variable. RLS is a no-op for superusers and table owners (unless
-- FORCE ROW LEVEL SECURITY is set, which STILL doesn't apply to superusers) —
-- since migrations run as the "postgres" superuser, the app must connect at
-- runtime as a separate, unprivileged role for these policies to mean
-- anything. That role is created here; its real password is set afterwards
-- by scripts/setup-db-role.sh (reads APP_DB_PASSWORD from .env — never
-- committed to a migration file).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'exec_board_app') THEN
    CREATE ROLE exec_board_app LOGIN PASSWORD 'changeme-rotate-immediately';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE exec_board TO exec_board_app;
GRANT USAGE ON SCHEMA public TO exec_board_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO exec_board_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO exec_board_app;

-- "User" is intentionally NOT included below: tenant resolution (TR-14) has
-- to read tokenHash across all users before it knows who "the tenant" is,
-- so User can't be scoped by app.current_user_id. It has no board content
-- and isn't part of the cross-tenant leak surface TR-15 defends against.

ALTER TABLE "Board" ENABLE ROW LEVEL SECURITY;
CREATE POLICY board_tenant_isolation ON "Board"
  USING ("ownerId" = current_setting('app.current_user_id', true));

ALTER TABLE "Node" ENABLE ROW LEVEL SECURITY;
CREATE POLICY node_tenant_isolation ON "Node"
  USING (EXISTS (
    SELECT 1 FROM "Board"
    WHERE "Board"."id" = "Node"."boardId"
      AND "Board"."ownerId" = current_setting('app.current_user_id', true)
  ));

ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_tenant_isolation ON "Event"
  USING (EXISTS (
    SELECT 1 FROM "Board"
    WHERE "Board"."id" = "Event"."boardId"
      AND "Board"."ownerId" = current_setting('app.current_user_id', true)
  ));

ALTER TABLE "Blocker" ENABLE ROW LEVEL SECURITY;
CREATE POLICY blocker_tenant_isolation ON "Blocker"
  USING (EXISTS (
    SELECT 1 FROM "Board"
    WHERE "Board"."id" = "Blocker"."boardId"
      AND "Board"."ownerId" = current_setting('app.current_user_id', true)
  ));

ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
CREATE POLICY session_tenant_isolation ON "Session"
  USING (EXISTS (
    SELECT 1 FROM "Board"
    WHERE "Board"."id" = "Session"."boardId"
      AND "Board"."ownerId" = current_setting('app.current_user_id', true)
  ));

ALTER TABLE "Import" ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_tenant_isolation ON "Import"
  USING (EXISTS (
    SELECT 1 FROM "Board"
    WHERE "Board"."id" = "Import"."boardId"
      AND "Board"."ownerId" = current_setting('app.current_user_id', true)
  ));

ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;
CREATE POLICY report_tenant_isolation ON "Report"
  USING (EXISTS (
    SELECT 1 FROM "Board"
    WHERE "Board"."id" = "Report"."boardId"
      AND "Board"."ownerId" = current_setting('app.current_user_id', true)
  ));
