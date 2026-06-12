# Changelog

All notable changes to `@voicethere/cli` are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/). Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
