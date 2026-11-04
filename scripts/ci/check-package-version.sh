#!/usr/bin/env bash
# Usage: check-package-version.sh [<version>]
# With <version> (release tag): package.json must equal it.
# Without: package.json must equal the newest "## [X.Y.Z]" heading in CHANGELOG.md.
# Env overrides: PACKAGE_JSON, CHANGELOG.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PKG_FILE="${PACKAGE_JSON:-$ROOT/package.json}"
CHANGELOG_FILE="${CHANGELOG:-$ROOT/CHANGELOG.md}"

PKG="$(node -p 'require(process.argv[1]).version' "$PKG_FILE")" || exit 1

if [[ $# -ge 1 && -n "$1" ]]; then
  VERSION="$1"
  if [[ "$PKG" == "$VERSION" ]]; then
    exit 0
  fi
  echo "package.json is $PKG but the tag is release/$VERSION; run scripts/ci/bump-version.sh $VERSION in release prep" >&2
  exit 1
fi

NEWEST=""
if [[ -f "$CHANGELOG_FILE" ]]; then
  NEWEST="$(grep -m1 -E '^## \[[0-9]+\.[0-9]+\.[0-9]+\]' "$CHANGELOG_FILE" | sed -E 's/^## \[([0-9]+\.[0-9]+\.[0-9]+)\].*/\1/')"
fi
if [[ -z "$NEWEST" ]]; then
  echo "CHANGELOG.md has no released version heading" >&2
  exit 1
fi
if [[ "$PKG" == "$NEWEST" ]]; then
  exit 0
fi
echo "package.json is $PKG but the newest CHANGELOG entry is $NEWEST" >&2
exit 1
