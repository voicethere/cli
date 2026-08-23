# Changelog

All notable changes to `@voicethere/cli` are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/). Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.12.0] - 2026-08-23

### Added

- **`projects session-settings`** — `conversation_recording_enabled` and `conversation_recording_metered_overage_enabled` (bool) for opt-in conversation audio recording and overage mode.
- **`projects billing-settings list|set`** — subscription overage toggles and budget cap (`conversation_recording_metered_overage_enabled`, agent-log overage, budget cap).
- **`sessions recording <sessionId>`** — download a session’s conversation recording (`--wait`, `--output`, `--json`).

## [0.11.0] - 2026-08-12

### Changed

- Default API base is now `https://app.voicethere.io/api/v1` (production). Staging/custom hosts via `VOICETHERE_API_BASE` or `login --api-base`.

## [0.10.0] - 2026-08-09

### Added

- **HTTP retries** — control-plane API calls (`VoicethereApi` / `UserApi`) retry transport failures (`fetch failed`, connection resets/timeouts) and gateway **502/503/504** with fixed backoff: 500ms, 1s, 2.5s, 5s, 15s, 30s, 60s (8 attempts max).
- **`error_id` on CLI errors** — when the platform returns a unified AppError envelope, stderr prints `error_id` and `request_id` via `formatCliError` for support correlation.

## [0.9.0] - 2026-08-04

### Removed

- **`voicethere projects errors list`** — session failures are browsed via **`projects logs list --severity error`** (or `--level error`). Errors persist in agent logs with `fields.kind = session_error`, `fields.projectId`, `fields.sessionId`, and message prefix `[CODE]`.

### Changed

- **`projects logs list`** — documents `--severity` as alias for `--level`; E2E smokes assert session errors through this filter.

## [0.8.0] - 2026-08-03

### Added

- **`projects conversation export`** — async JSON export (`POST/GET …/conversation/exports`) with `--session`, `--q`, `--all`, time-window flags (`--period`, `--from`, `--to`), `--wait`, and `-o/--output`.
- **`projects conversation list` / `search`** — `--period`, `--from`, `--to`, and list `--cursor` for API parity with the control plane.

## [0.7.1] - 2026-07-31

### Changed

- Default **`tts.speed`** is now **0.9** (was 0.85).

## [0.7.0] - 2026-07-31

### Added

- **`voicethere usage`** / **`projects usage show`** — project and org usage credit dashboards (`GET /projects/:id/usage`, `GET /org/usage`) with period/bucket filters.
- **`projects conversation`** — `list`, `get <sessionId>`, and `search <query>` for stored voice transcripts (`GET /projects/:id/conversation?q=`).
- **`projects session-settings`** — `conversation_history_enabled` (bool, default `true`). Turn off to stop storing new STT/TTS conversation transcripts for a project.

### Changed

- Default **`tts.speed`** is now **0.85** (was 0.6).
- Dependency: `@voicethere/agent` **^0.2.17**.

## [0.6.0] - 2026-07-30

### Added

- **`projects voice-advanced set tts.speed`** — Sherpa Piper speaking-rate (0.2–2.0, default 0.6), editable on every subscription tier. Also documents **`tts.postUtteranceSilenceMs`** in CLI help/list.

## [0.5.0] - 2026-07-29

### Added

- **`projects voice catalog`** — lists live Sherpa STT/TTS models from `GET /api/v1/voice/sherpa-models` (no hardcoded model ids). Use `--json` for the full `/voice/models` provider payload.
- **`projects voice set --interactive`** — prompts for STT/TTS providers and Sherpa model ids from the control-plane catalog; validates `--*-model-id` against the fetched list.

### Changed

- Voice model selection is driven by the platform catalog so new NFS-preloaded voices (Lessac high, GLaDOS high, etc.) appear without a CLI release.

## [0.4.1] - 2026-07-29

### Fixed

- **Device-login poll Retry-After clamp** — raise `POLL_RETRY_AFTER_MAX_MS` from 5s to 30s so browser login honors platform `slow_down` intervals (up to 30s). A 5s cap under-waited the server, kept resetting `last_polled_at`, and could time out after approve without ever minting a key.

## [0.4.0] - 2026-07-25

### Added

- **Browser device login (default `voicethere login`)** — opens the dashboard approval page, polls for confirmation, and stores a personal API key (`vthu_`) with `active_org_id`. Emits machine-readable `voicethere-login:*` lines for automation (status, verification URL, user code, active org — never the device code or API key).
- **`--force` / `--no-open`** — force a new authorization; print URL/code without opening a browser.
- **Existing-credential skip** — when saved (or env) credentials still work, login exits without starting another authorization. With a linked `.voicethere/config.json` project, accessibility of that project is required before skip.
- **Linked-project check after approve** — verifies the returned personal key can access the configured project; on mismatch, leaves project config unchanged and reports clearly.

### Changed

- **Credentials model** — file may hold org/project `api_key` and/or personal `user_api_key`; writes remain atomic with mode `0600`. Environment variables (`VOICETHERE_API_KEY`, `VOICETHERE_USER_API_KEY`, `VOICETHERE_API_BASE`, `VOICETHERE_ORG_ID`) take precedence over the file. Browser login clears a stored dashboard cookie **and any file `api_key`**, leaving an interactive personal-key state; `login --api-key` / env org keys remain the CI path.
- **Linked-project verification** — after browser approve, verifies the linked project with the minted `vthu_` + `active_org_id` before emitting machine `completed`; failure exits nonzero without rewriting `.voicethere/config.json`.
- **Env override guard** — browser login aborts before minting when `VOICETHERE_API_KEY` or `VOICETHERE_USER_API_KEY` is set (saved keys cannot override env).
- **API client selection** — personal keys send `x-voicethere-org-id`; org/project keys (`vth_` / `vthc_`) remain preferred when present for automation.

### Security

- Device authorization uses hashed device/user codes server-side; the CLI never writes secrets into `.voicethere/config.json`. `--force` replaces local credentials only and does not revoke other devices.

## [0.3.17] - 2026-07-24

### Changed

- **Deploy and deletion `--wait` polling** — adaptive jittered backoff (1×→2×→3×→5× of the base interval, reset on status/step progress) for `deploy`, `undeploy`, `projects delete`, and `account deletion` waits. Reduces API traffic during long-running jobs.

## [0.3.16] - 2026-07-20

### Added

- **`voicethere projects logs list`** — list searchable customer agent logs for a project or `--session` (filter session failures with `--severity error`).

## [0.3.15] - 2026-07-17

### Added

- **`voicethere projects delete --wait`** — when staging/production queues async project deletion (`202` + `job_id`), poll `GET /projects/:id/deletion/:jobId` until completed or failed (same pattern as `deploy --wait` / `undeploy --wait`).

## [0.3.14] - 2026-07-10

### Added

- **Terms of Service gate** — when the platform returns `NWRTC_TOS_NOT_ACCEPTED`, CLI commands print a clear error with the dashboard `/accept-tos` URL instead of a generic API failure. Applies to org and user API clients.

### Changed

- **`projects session-settings` help** — clarify `idle_timeout_voice_activity` and `idle_timeout_dc_inbound` descriptions to match the platform dashboard (when each idle-reset behavior is on or off).

## [0.3.13] - 2026-07-08

### Fixed

- **`voicethere login --user-api-key`** — clear stored `active_org_id` when a new user API key is provided so ephemeral org setup (e.g. E2E) does not inherit a prior org selection.

## [0.3.12] - 2026-07-08

### Added

- **`voicethere login --user-api-key`** — store personal API key (`vthu_`) for org/account commands (`VOICETHERE_USER_API_KEY` env override). Persists `active_org_id` when using `orgs use`.
- **`voicethere orgs list` / `orgs use`** — list organizations and set the active org (user API key or legacy dashboard cookie).
- **`voicethere org transfer-ownership`** — transfer org ownership to another member (user API key).
- **`voicethere account deletion preview|request-code|confirm`** — account deletion flow via user API key.
- **`voicethere account deletion confirm --wait`** — poll until account teardown completes or fails.
- **`voicethere login --dashboard-cookie`** — legacy browser Cookie header (`VOICETHERE_DASHBOARD_COOKIE`); prefer `--user-api-key`.

## [0.3.11] - 2026-07-07

### Added

- **`voicethere projects errors list --json`** — machine-readable session error rows for automation and E2E smoke tests.
- **Tests** — Vitest coverage for JSON and table output modes on `projects errors list`.

## [0.3.10] - 2026-07-05

### Changed

- **`voicethere projects subscription set none`** — restore clearing project subscription assignment (projects may exist unassigned; cloud deploy requires an assigned subscription on the platform).
- **`voicethere build promote`** — success message now points to `voicethere deploy --wait` for cloud rollout.

### Fixed

- Reverts the CLI restriction that blocked clearing subscriptions (shipped briefly after 0.3.9).

## [0.3.9] - 2026-07-03

### Added

- **`voicethere projects subscription list`** — list organization subscriptions (tier, status, assigned project).
- **`voicethere projects subscription show`** — show the subscription assigned to a project (JSON).
- **`voicethere projects subscription set <subscriptionId>`** — assign a subscription to a project, or pass `none` to clear.
- **Subscription API client** — `listSubscriptions`, `getProjectSubscription`, and `setProjectSubscription` on the platform API wrapper.
- **`mode` project setting** — `voicethere projects settings list` / `set` now supports runner mode (`voice`, `data`, `voice+data`).

## [0.3.8] - 2026-06-28

### Changed

- Release 0.3.8 version bump.

## [0.3.7] - 2026-06-26

### Added

- `billing_started_at` on session API types and `voicethere sessions billing` output (text + `--json`)

## [0.3.6] - 2026-06-22

### Added

- `voicethere projects voice-advanced list` — read resolved VAD, barge-in, and speech-event settings
- `voicethere projects voice-advanced set` — update one dotted key (apply on next `deploy --wait`)
- `voicethere projects voice-advanced reset` — clear all advanced voice overrides
- `--help` on `voice-advanced` documents every key, default, range, and enum values

## [0.3.5] - 2026-06-20

### Added

- `voicethere projects settings list` / `set` — `shared_child_per_session` and `agent_crash_policy` runner settings
- `voicethere projects errors list` — session error rows for a project (optional `--session` filter)

### Changed

- `agent_crash_policy` set accepts `disconnect_all` or `restart_child` (enum, not boolean)

## [0.3.4] - 2026-06-19

### Added

- `voicethere projects session-settings list` — read WebRTC idle timeout and crash error message settings
- `voicethere projects session-settings set` — update one setting (apply on next `deploy --wait`)
- `--help` on `session-settings` documents every key, default, range, and billing notes

### Changed

- CLI `--version` reads from `package.json` (was stuck at 0.2.2 in help output)

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
