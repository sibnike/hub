#!/usr/bin/env bash
# Vercel Ignored Build Step: exit 0 = skip deploy, exit 1 = build.
# Skip when diff contains only docs/**, tasks/**, or *.md (any path).

set -euo pipefail

if [[ -z "${VERCEL_GIT_PREVIOUS_SHA:-}" || -z "${VERCEL_GIT_COMMIT_SHA:-}" ]]; then
  exit 1
fi

if [[ "$VERCEL_GIT_PREVIOUS_SHA" == "$VERCEL_GIT_COMMIT_SHA" ]]; then
  exit 1
fi

has_changes=0
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  has_changes=1
  if [[ "$file" == docs/* || "$file" == tasks/* || "$file" == *.md ]]; then
    continue
  fi
  exit 1
done < <(git diff --name-only "$VERCEL_GIT_PREVIOUS_SHA" "$VERCEL_GIT_COMMIT_SHA")

if [[ "$has_changes" -eq 0 ]]; then
  exit 0
fi

exit 0
