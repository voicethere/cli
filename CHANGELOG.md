# Changelog

All notable changes to `@voicethere/cli` are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/). Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.3] - 2026-06-19

### Added

- `voicethere projects voice catalog` — list STT/TTS providers, Sherpa models, and required credential keys
- `voicethere projects voice show` — read project voice settings (vendors, models)
- `voicethere projects voice set` — update STT/TTS vendors and models (apply on next `deploy --wait`)

## [0.3.2] - 2026-06-19

### Added

- `voicethere sessions list` — paginated voice session list for a project
- `voicethere sessions billing` — billable seconds and status for one orchestrator session id

### Changed

- Sessions list API returns `{ sessions, start, end, count }` with a 50-row page cap; CLI prints a page footer

## [0.3.1] - 2026-06-16

### Changed

- Dev dependency `@voicethere/agent` **^0.1.9** (CJS `default`/`require` export conditions for `./verify` — aligns with platform workers and local verify under tsx)

## [0.3.0] - 2026-06-15

### Added

- `voicethere deploy --wait` — poll platform deploy job until cluster rollout completes or fails
- `voicethere undeploy --wait` — remove runner pools for a project and optionally wait for completion
- `voicethere projects environment` — list, view, upsert, delete agent env vars for a project
- `voicethere projects secrets` — list, create, delete encrypted project secrets
- `voicethere projects settings list|set` — read/update runner pool settings (`warm_pool_enabled`, idle timeout, etc.)
- `voicethere api-keys list|create|revoke` — manage admin and client API keys from the CLI

### Changed

- Dev dependency `@voicethere/agent` ^0.1.7 (echo + echo-dc templates for local verify)

## [0.2.2] - 2026-06-14

### Added

- `voicethere projects delete --force` — remove a project from the control plane

### Changed

- Verbose path logging on stderr for debugging linked project/bundle resolution

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
