#!/usr/bin/env bash
# §7: "the tunnel runs only during working sessions and is torn down after."
set -euo pipefail
cd "$(dirname "$0")/.."

pkill -f "ngrok http" 2>/dev/null && echo "tunnel stopped" || echo "no tunnel was running"
rm -f .exec-board/tunnel-url.txt
