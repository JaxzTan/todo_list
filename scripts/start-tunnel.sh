#!/usr/bin/env bash
# §8: exposes the local Next.js port (never the DB port) through ngrok, with
# basic auth from the traffic-policy template. Free-tier ngrok issues a new
# hostname every restart (§8's "tunnel URL rotation" problem) — rather than
# paying for a reserved domain, this writes the current URL to
# .exec-board/tunnel-url.txt on every launch, which board-client.mts reads
# as a fallback when EXEC_BOARD_BASE_URL isn't set (the "resolver
# indirection" option from docs/list.md decision #2).
#
# Two modes:
#   - default: backgrounds ngrok (nohup) and returns once the URL is known —
#     for when you want the tunnel up but keep using this terminal.
#   - FOREGROUND=1: attaches ngrok directly (`make tunnel` uses this) so you
#     watch its live request log; Ctrl+C stops the tunnel. The URL is still
#     captured for tunnel-url.txt, via a small background poller that exits
#     on its own once it's written one.
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
source .env
set +a

: "${NGROK:?NGROK authtoken is not set in .env}"
: "${USER1:?USER1 is not set in .env}"
: "${PASSWORD1:?PASSWORD1 is not set in .env}"
: "${USER2:?USER2 is not set in .env}"
: "${PASSWORD2:?PASSWORD2 is not set in .env}"

PORT="${1:-3000}"
mkdir -p .exec-board

POLICY_FILE=".exec-board/traffic-policy.generated.yml"
sed -e "s/__USER1__/${USER1}/" -e "s/__PASSWORD1__/${PASSWORD1}/" \
    -e "s/__USER2__/${USER2}/" -e "s/__PASSWORD2__/${PASSWORD2}/" \
    infra/traffic-policy.template.yml > "$POLICY_FILE"

if lsof -iTCP:4040 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "ngrok already running (port 4040 in use) — stop it first with scripts/stop-tunnel.sh" >&2
  exit 1
fi

capture_url() {
  for _ in $(seq 1 20); do
    sleep 0.5
    URL=$(curl -s http://127.0.0.1:4040/api/tunnels \
      | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const t=j.tunnels&&j.tunnels[0];if(t)console.log(t.public_url);}catch(e){}})" \
      2>/dev/null || true)
    if [ -n "${URL:-}" ]; then
      echo -n "$URL" > .exec-board/tunnel-url.txt
      echo "tunnel is up: $URL — basic auth from .env (USER1/PASSWORD1, USER2/PASSWORD2)"
      return 0
    fi
  done
  echo "ngrok did not come up in time — check .exec-board/ngrok.log" >&2
  return 1
}

if [ "${FOREGROUND:-}" = "1" ]; then
  capture_url &
  exec ngrok http "$PORT" \
    --authtoken "$NGROK" \
    --traffic-policy-file "$POLICY_FILE"
fi

echo "starting ngrok on port $PORT..."
nohup ngrok http "$PORT" \
  --authtoken "$NGROK" \
  --traffic-policy-file "$POLICY_FILE" \
  --log stdout > .exec-board/ngrok.log 2>&1 &
disown

capture_url
