#!/usr/bin/env bash
# Run the e2e suite the same way CI does.
#   scripts/e2e.sh dev  [pytest args]   build _site, serve it on :8000, run the full suite
#   scripts/e2e.sh prod [pytest args]   run the smoke suite against the live site
set -euo pipefail

cd "$(dirname "$0")/.."
PRODUCTION_URL="${PRODUCTION_URL:-https://rehnumat.github.io/goodbought-website/}"
mode="${1:-dev}"
shift || true

case "$mode" in
  dev)
    scripts/build_site.sh
    python -m http.server 8000 --bind 127.0.0.1 --directory _site >/dev/null 2>&1 &
    server_pid=$!
    trap 'kill "$server_pid"' EXIT
    curl --silent --fail --retry 20 --retry-connrefused --retry-delay 1 \
      http://127.0.0.1:8000/ >/dev/null
    EXPECTED_COMMIT="$(git rev-parse HEAD)" pytest "$@"
    ;;
  prod)
    pytest -m smoke --base-url "$PRODUCTION_URL" "$@"
    ;;
  *)
    echo "usage: $0 dev|prod [pytest args]" >&2
    exit 2
    ;;
esac
