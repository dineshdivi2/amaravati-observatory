#!/usr/bin/env sh
# Serve the site at http://127.0.0.1:4267/ (Node first, Python fallback). Ctrl+C to stop.
cd "$(dirname "$0")" || exit 1
PORT="${1:-4267}"
if command -v node >/dev/null 2>&1; then exec node server.mjs "$PORT"; fi
echo "Node not found; using Python's static server (no compression)."
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory site
