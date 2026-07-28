#!/usr/bin/env bash
# Format files as they are written, so formatting never shows up in a diff
# as unrelated noise.
#
# Reads the PostToolUse hook payload on stdin, extracts the edited path, and
# runs the right formatter for its extension. Exits 0 always — a formatter
# being unavailable must never block an edit.

set -uo pipefail

payload=$(cat)
file=$(printf '%s' "$payload" | python3 -c '
import json, sys
try:
    print(json.load(sys.stdin).get("tool_input", {}).get("file_path", ""))
except Exception:
    print("")
' 2>/dev/null)

[ -z "$file" ] && exit 0
[ -f "$file" ] || exit 0

case "$file" in
  *.py)
    if command -v uv >/dev/null 2>&1; then
      (cd "$CLAUDE_PROJECT_DIR/apps/api" \
        && uv run ruff format "$file" >/dev/null 2>&1 \
        && uv run ruff check --fix "$file" >/dev/null 2>&1) || true
    fi
    ;;
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md)
    if [ -x "$CLAUDE_PROJECT_DIR/node_modules/.bin/prettier" ]; then
      "$CLAUDE_PROJECT_DIR/node_modules/.bin/prettier" --write "$file" >/dev/null 2>&1 || true
    fi
    ;;
esac

exit 0
