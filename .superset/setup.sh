#!/usr/bin/env bash
set -euo pipefail

# Copy the gitignored local files listed in .worktreeinclude (env files,
# web-ext config) from the main checkout. Missing files are skipped.
# Dependencies are not installed here; run `pnpm install` when you need them.
if [ -n "${SUPERSET_ROOT_PATH:-}" ] && [ -f .worktreeinclude ]; then
  while IFS= read -r file || [ -n "$file" ]; do
    case "$file" in '' | \#*) continue ;; esac
    if [ -e "$SUPERSET_ROOT_PATH/$file" ] && [ ! -e "$file" ]; then
      cp "$SUPERSET_ROOT_PATH/$file" "$file"
      echo "Copied $file"
    fi
  done < .worktreeinclude
fi
