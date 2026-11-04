#!/usr/bin/env bash
# Tests for check-package-version.sh.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
FAILS=0

printf '{"name":"x","version":"0.18.2"}\n' > "$TMP/pkg-old.json"
printf '{"name":"x","version":"0.20.0"}\n' > "$TMP/pkg-new.json"
printf '# Changelog\n\n## [Unreleased]\n\n- Pending.\n\n## [0.20.0] - 2026-11-04\n\n### Added\n\n- A.\n\n## [0.19.0] - 2026-11-03\n\n- B.\n' > "$TMP/CHANGELOG.md"
printf '# Changelog\n\n## [Unreleased]\n' > "$TMP/only-unreleased.md"

run() { # name want substr pkg changelog [version]
  local name="$1" want="$2" substr="$3" pkg="$4" cl="$5" out rc
  shift 5
  out="$(PACKAGE_JSON="$pkg" CHANGELOG="$cl" bash "$HERE/check-package-version.sh" "$@" 2>&1)"
  rc=$?
  if [[ "$rc" -ne "$want" ]] || { [[ -n "$substr" ]] && [[ "$out" != *"$substr"* ]]; }; then
    echo "FAIL: $name (exit $rc, want $want)"; echo "$out"; FAILS=$((FAILS + 1))
  else
    echo "ok: $name"
  fi
}

run "tag match" 0 "" "$TMP/pkg-new.json" "$TMP/CHANGELOG.md" 0.20.0
run "tag mismatch" 1 "release/0.20.0" "$TMP/pkg-old.json" "$TMP/CHANGELOG.md" 0.20.0
run "no arg, pkg equals newest heading below Unreleased" 0 "" "$TMP/pkg-new.json" "$TMP/CHANGELOG.md"
run "no arg, pkg behind newest heading" 1 "newest CHANGELOG entry is 0.20.0" "$TMP/pkg-old.json" "$TMP/CHANGELOG.md"
run "no arg, only Unreleased" 1 "no released version heading" "$TMP/pkg-new.json" "$TMP/only-unreleased.md"

exit "$FAILS"
