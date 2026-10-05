#!/usr/bin/env bash
# Build the deployable site into _site/: only the files the store needs,
# plus build-info.json so we can prove which commit is live.
set -euo pipefail

cd "$(dirname "$0")/.."

SITE_FILES=(index.html styles.css script.js items.json js images)
OUT=_site

rm -rf "$OUT"
mkdir -p "$OUT"
cp -R "${SITE_FILES[@]}" "$OUT"/

commit="${GITHUB_SHA:-$(git rev-parse HEAD)}"
built_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '{\n  "commit": "%s",\n  "built_at": "%s"\n}\n' "$commit" "$built_at" > "$OUT/build-info.json"

echo "Built $OUT for commit $commit"
