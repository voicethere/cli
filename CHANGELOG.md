# Changelog

All notable changes to `@voicethere/cli` are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/). Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-06-12

### Changed

- **Breaking:** primary identifiers are positional args instead of flags:
  - `projects create <name>` (was `--name`)
  - `projects use [projectId]` (was `projects use --project`; interactive picker in a TTY when omitted and no local config)
  - `build validate [file]`, `build upload [file]`, `build list`, `build promote [buildId]` (removed `--file` / `--project` overrides)
- Build commands use the **active project** from `.voicethere/config.json` automatically — no per-command project id
- `projects use` with no args reuses an existing `.voicethere/config.json` when present (validates with the API and refreshes metadata)
- `build promote` with no build id opens an interactive build picker in a TTY
- Optional bundle arg defaults to config `bundle` or `dist/agent.js`; bundle paths resolve relative to the linked repo root
- Commands log resolved paths on stderr at startup (`[voicethere] bundle: …`, `project: …`, etc.)

## [0.1.0] - 2026-06-12

### Added

- `voicethere login` — store API key and API base URL
- `voicethere projects` — list, create, `use` (link repo), `show`
- `.voicethere/config.json` — commit project id and default bundle path (no secrets)
- `voicethere build validate` — `@voicethere/agent` sandbox verify
- `voicethere build upload -m "…"` — store build in history with optional message
- `voicethere build list` — uploaded builds with id, time, status, active flag, message
- `voicethere build promote <buildId>` — set active build via control plane promote API
- `voicethere deploy` — reserved stub (cluster rollout coming later)

### Changed

- MIT license (copyright A KIRILYUK LLC)
- Public README and user-facing docs (no internal milestone references)
