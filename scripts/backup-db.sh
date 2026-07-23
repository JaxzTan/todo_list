#!/usr/bin/env bash
# §8: "a single local volume with no offsite copy is one disk failure from
# total loss of every board, and TR-3's leniency means the database is the
# only recovery path for a mangled import... not optional given the rest
# of the design." Point BACKUP_DIR at a synced folder (Drive/Dropbox/etc.)
# to get the offsite copy that requires; a plain local dir only protects
# against DB corruption, not disk loss.
#
# Not registered as a cron job by this script — see docs/list.md for the
# one-line crontab/launchd entry to add it, since scheduling recurring
# background automation on the host machine is a step worth doing
# deliberately rather than silently.
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
source .env
set +a

BACKUP_DIR="${EXEC_BOARD_BACKUP_DIR:-backups}"
RETENTION_DAYS="${EXEC_BOARD_BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUT_FILE="$BACKUP_DIR/exec_board-$TIMESTAMP.dump"

mkdir -p "$BACKUP_DIR"

echo "backing up $DB_NAME to $OUT_FILE..."
docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom > "$OUT_FILE"

SIZE=$(du -h "$OUT_FILE" | cut -f1)
echo "wrote $OUT_FILE ($SIZE)"

DELETED=0
while IFS= read -r -d '' old; do
  rm -f "$old"
  DELETED=$((DELETED + 1))
done < <(find "$BACKUP_DIR" -name 'exec_board-*.dump' -mtime "+${RETENTION_DAYS}" -print0)
echo "pruned $DELETED backup(s) older than $RETENTION_DAYS days"
