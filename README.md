# @voicethere/cli

VoiceThere cloud CLI for API login, project management, and agent bundle upload.

Requires **Node.js 22+**.

**Release flow:** `build upload` stores a bundle in history; `build promote <buildId>` sets the active build in the control plane only; `deploy --wait` promotes (if needed) and rolls out to cloud runners.

## Install

```bash
npm install -g @voicethere/cli
```

Or run without a global install:

```bash
npx @voicethere/cli <command>
```

## Debugging

Commands print resolved paths on **stderr** at startup:

```text
[voicethere] project: 550e8400-… (project config (/path/.voicethere/config.json))
[voicethere] bundle: /path/to/dist/agent.js (project config (/path/.voicethere/config.json))
```

Use this when a command fails to confirm which project and bundle file were picked up.

## Project selection

The CLI remembers the **active project** in **`.voicethere/config.json`** (safe to commit — no API keys).

| Situation                       | What happens                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| Config file present             | `build upload`, `build list`, `build promote` use its `project_id` automatically         |
| No config, interactive terminal | `projects use` shows a numbered project picker                                           |
| No config, CI / script          | Run `voicethere projects use <projectId>` once (or commit config from `projects create`) |

You do **not** need to run `projects use` on every command when the config file is already in the repo.

## Typical workflow

### 1. One-time login (per machine)

Credentials live in `~/.config/voicethere/credentials.json` (mode `0600`) — **not** in your agent repo. Never put API keys in `.voicethere/config.json`.

**Default — browser login** (recommended for interactive machines):

```bash
voicethere login
# Opens the dashboard approval page, then stores a personal API key (vthu_…)
# and active organization. If a project is linked in .voicethere/config.json,
# login also checks that your account can access that project.
```

| Flag               | Behavior                                                                |
| ------------------ | ----------------------------------------------------------------------- |
| _(none)_           | Validate existing credentials; skip if they still work (see below)      |
| `--force`          | Start a new browser authorization even when local credentials are valid |
| `--no-open`        | Print the verification URL and user code; do not open a browser         |
| `--api-base <url>` | Override API base for this login (also honored from env / saved file)   |

If credentials already work, `voicethere login` **skips** creating another authorization:

- With a linked project (`.voicethere/config.json`): requires a successful project fetch.
- Without a linked project: requires a successful project list.
- Auth failures (`401` / `403` / `404` / TOS not accepted) start browser login again.
- Network / server errors **abort** without rewriting credentials — fix connectivity, or use `--force`.

**Manual API key login** (CI, automation, or when you already have a key):

```bash
voicethere login --api-key vth_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# personal key for org/account commands (dashboard Settings → API keys):
voicethere login --api-key vth_… --user-api-key vthu_…
# staging / custom API host:
voicethere login --api-key "$VOICETHERE_API_KEY" --api-base https://app.voicethere.dev/api/v1
```

Default API base: `https://app.voicethere.dev/api/v1`

**Credentials & environment precedence** (env wins over the credentials file):

| Variable                      | Overrides                                         |
| ----------------------------- | ------------------------------------------------- |
| `VOICETHERE_API_KEY`          | Org / project API key (`vth_` / `vthc_`)          |
| `VOICETHERE_USER_API_KEY`     | Personal API key (`vthu_`)                        |
| `VOICETHERE_API_BASE`         | API base URL                                      |
| `VOICETHERE_ORG_ID`           | Active organization for personal keys             |
| `VOICETHERE_CREDENTIALS_PATH` | Credentials file location (tests / isolated runs) |
| `VOICETHERE_PROJECT_CONFIG`   | Path to `.voicethere/config.json`                 |

After browser login, if those env vars are set, the CLI prints a warning that they override the newly saved file. Personal-key requests send `x-voicethere-org-id` when an active org is selected (`orgs use`).

**Security notes**

- Credentials file is written atomically with mode `0600`.
- Browser login mints a **personal** key (`vthu_`), **clears any stored org/project `api_key` from the credentials file** (so interactive commands use the new personal key), and does not put secrets in project config. Explicit `VOICETHERE_API_KEY` / `VOICETHERE_USER_API_KEY` remain authoritative when set — browser login **aborts** if those env vars are present so a saved key cannot silently lose to a broken env override.
- After approval, the CLI verifies a linked project with the **minted** personal key + returned active org before reporting success.
- `--force` replaces the local personal key for this machine; it does **not** revoke keys on other devices.
- Linked-project mismatch: the CLI keeps `.voicethere/config.json` unchanged and fails login (nonzero) if the new personal key cannot access that project.
- Prefer personal keys over the legacy `--dashboard-cookie` path.

More detail: [CLI login guide](https://app.voicethere.dev/docs/cli-login) on the VoiceThere docs site.

### 2. New agent repo — create project and commit config

From your agent project root (where you build `dist/agent.js`):

```bash
npm install @voicethere/agent
npx @voicethere/agent build

# Creates the cloud project and uses it (.voicethere/config.json)
voicethere projects create "My Voice Agent"

git add .voicethere/config.json
git commit -m "chore: use VoiceThere project"
```

### 3. Upload a build (store artifact)

Upload **stores** a new immutable build in history — it does **not** go live yet.

```bash
voicethere build validate    # optional; uses config bundle or dist/agent.js
voicethere build upload -m "Add Spanish greeting and fix barge-in"
```

`-m` / `--message` is like a git commit message: a short label so you can tell builds apart in `build list` and the dashboard.

### 4. Promote a build (set active in control plane)

**Promote** sets the **active** build in the VoiceThere control plane only. To roll out to cloud runners, run **`voicethere deploy --wait`** (promote + cluster rollout in one step).

Pass the build UUID from **`build upload`** or **`build list`**, or omit it in an interactive terminal to pick from a list:

```bash
voicethere build list
voicethere build promote <build-uuid>
# interactive: voicethere build promote
```

Typical release loop:

```bash
npx @voicethere/agent build
voicethere build upload -m "v0.2 — shorter silence timeout"
voicethere build promote <build-uuid-from-upload-or-list>
```

### 5. Clone an existing repo (config already in git)

```bash
git clone <your-agent-repo>
cd <your-agent-repo>
voicethere login --api-key "$VOICETHERE_API_KEY"

npx @voicethere/agent build
voicethere build upload
voicethere build list
voicethere build promote <build-uuid>
```

No `projects use` needed — the active project travels with the repo.

### 6. Use a different cloud project

```bash
voicethere projects list
voicethere projects use <uuid> --slug my-agent --bundle dist/agent.js
git add .voicethere/config.json && git commit -m "chore: use VoiceThere project"
```

Re-run `voicethere projects use` with no args to confirm the current project (reads existing config).

Inspect the selection anytime:

```bash
voicethere projects show
```

### 7. CI / automation

**With committed `.voicethere/config.json`** (typical agent repo):

```bash
voicethere login --api-key "$VOICETHERE_API_KEY"
npx @voicethere/agent build
voicethere build upload -m "$GITHUB_SHA — $GITHUB_REF_NAME" --skip-validate
voicethere build promote <build-uuid-from-upload>
```

No `projects use` step — the config file is the active project.

**Without a config file** (one-off job cwd):

```bash
voicethere login --api-key "$VOICETHERE_API_KEY"
voicethere projects use <project-uuid>
npx @voicethere/agent build
voicethere build upload --skip-validate
voicethere build promote <build-uuid-from-upload>
```

Other CI notes:

- **Credentials:** `VOICETHERE_CREDENTIALS_PATH` for isolated test runs
- **Config override:** `VOICETHERE_PROJECT_CONFIG=/path/to/config.json`

Split upload and promote across jobs if you want a human approval gate between them.

### 8. Deploy to cloud runners

`voicethere deploy --wait` **promotes the build (when needed) and rolls out to cloud runners**, blocking until the deployment is active (or failed).

```bash
voicethere build upload -m "v0.2 — shorter silence timeout"
voicethere deploy --wait
# or pin a build: voicethere deploy --wait --build-id <build-uuid>
```

Use **`build promote`** alone when you only need to update the control plane (e.g. smoke tests); use **`deploy --wait`** for anything that must run on staging runners.

## Repo config (version control)

Per-agent-repo file: **`.voicethere/config.json`**

| Field                  | Purpose                                       |
| ---------------------- | --------------------------------------------- |
| `project_id`           | Active platform project UUID                  |
| `project_slug`, `name` | Human-readable metadata (optional)            |
| `bundle`               | Default bundle path (default `dist/agent.js`) |

**Secrets stay global:** `~/.config/voicethere/credentials.json` (from `voicethere login`).

Example: [`.voicethere/config.json.example`](./.voicethere/config.json.example)

## Commands

| Command                                                                                          | Description                                                                                 |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `login [--force] [--no-open] [--api-base <url>]`                                                 | Browser device login (default); skip if credentials still work                              |
| `login --api-key <key> [--user-api-key <vthu>] [--api-base <url>] [--dashboard-cookie <cookie>]` | Manual key login (CI / automation); optional personal key                                   |
| `orgs list`                                                                                      | List organizations (`*` = active); requires user API key or legacy cookie                   |
| `orgs use <orgId>`                                                                               | Set active organization (persists `active_org_id` for user keys)                            |
| `org transfer-ownership <userId>`                                                                | Transfer org ownership (owner only)                                                         |
| `account deletion preview`                                                                       | JSON preview of owned orgs + deletion job                                                   |
| `account deletion request-code`                                                                  | Email 6-digit deletion verification code                                                    |
| `account deletion confirm <code> [--wait]`                                                       | Queue account deletion; `--wait` blocks until teardown completes                            |
| `projects list`                                                                                  | List org projects                                                                           |
| `projects create <name> [--slug <slug>]`                                                         | Create project; uses it (writes config)                                                     |
| `projects use [projectId]`                                                                       | Use project (picker or existing config when omitted)                                        |
| `projects show`                                                                                  | Print `.voicethere/config.json`                                                             |
| `projects delete [projectId] [--force] [--wait]`                                                 | Delete project + builds (type name to confirm, or `--force`; `--wait` polls async deletion) |
| `projects settings list`                                                                         | set Runner pool settings (warm pool, scale-down)                                            |
| `projects session-settings list`                                                                 | set WebRTC idle timeout + crash error message (see below)                                   |
| `projects errors list [--session] [--json]`                                                      | Structured session errors from dashboard API                                                |
| `projects voice catalog`                                                                         | show STT/TTS vendors and models                                                             |
| `build list`                                                                                     | Builds for the active project                                                               |
| `build validate [file]`                                                                          | Sandbox verify (default bundle from config)                                                 |
| `build upload [file] [-m <msg>]`                                                                 | Upload to active project                                                                    |
| `build promote [buildId]`                                                                        | Promote on active project (picker when omitted in TTY)                                      |
| `deploy [--wait] [--build-id]`                                                                   | Promote (if needed) + cloud rollout; `--wait` blocks                                        |

## Logging

Progress and resolved paths go to **stderr** as `[voicethere] …` so **stdout** stays clean for JSON/tables (scripts can pipe stdout).

| Mode        | Flag / env                                   | What you get                                                                              |
| ----------- | -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Default** | _(always on)_                                | High-level steps: “Creating project…”, “Uploading bundle…”, resolved project/bundle paths |
| **Verbose** | `-v` / `--verbose` or `VOICETHERE_VERBOSE=1` | API method + path, request bodies (no secrets), response status + timing, counts          |

Examples:

```bash
voicethere build upload
# stderr: [voicethere] Uploading agent bundle
#         [voicethere] project: …
#         [voicethere] bundle: …
#         [voicethere] Validating bundle locally before upload
#         [voicethere] Running @voicethere/agent verify on bundle
#         [voicethere] Uploading bundle to control plane API

voicethere -v build upload
# …plus [voicethere:verbose] api: https://…
#           [voicethere:verbose] POST /projects/…/builds
#           [voicethere:verbose] response: 201 (842ms)
```

Global `-v` works on any subcommand: `voicethere -v projects list`.

## Session settings (idle timeout)

Per-project WebRTC idle timeout and crash TTS message. Changes apply on the next **`voicethere deploy --wait`** (runner env).

```bash
voicethere projects session-settings --help   # all keys, defaults, ranges
voicethere projects session-settings list
voicethere projects session-settings set idle_timeout_seconds 90
voicethere projects session-settings set data_only_idle_timeout_seconds 60
voicethere projects session-settings set conversation_history_enabled false
voicethere projects session-settings set error_message "Sorry, something went wrong."
```

| Key                              | Type                                  | Default  | Notes                                         |
| -------------------------------- | ------------------------------------- | -------- | --------------------------------------------- |
| `idle_timeout_enabled`           | bool                                  | `true`   | `false` keeps sessions billable longer        |
| `idle_timeout_seconds`           | 30–120 (org may allow higher via API) | `30`     | Voice / both projects                         |
| `data_only_idle_timeout_seconds` | 30–120 (org may allow higher via API) | `30`     | Data-only: no client→server DC traffic        |
| `idle_timeout_voice_activity`    | bool                                  | `true`   | Reset on speech / agent TTS (voice / both)    |
| `idle_timeout_dc_inbound`        | bool                                  | `true`   | Reset on client data-channel sends            |
| `conversation_history_enabled`   | bool                                  | `true`   | `false` stops storing new STT/TTS transcripts |
| `error_message`                  | string                                | _(none)_ | Crash TTS in voice mode                       |

Boolean values for `set`: `true` / `false` / `1` / `0` / `yes` / `no`.

## Sessions and billing

List recent voice sessions (orchestrator session id, status, billable seconds):

```bash
voicethere sessions list <projectId> --start 0 --end 50
# or with .voicethere/config.json:
voicethere sessions list --start 0 --end 50
```

The API returns `{ sessions, start, end, count }` (max 50 rows per page). The CLI prints a `Showing X–Y of Z sessions` footer.

After a call ends (runner keep-alive billing), fetch billable duration:

```bash
voicethere sessions billing <orchestratorSessionId> --project <projectId>
voicethere sessions billing <orchestratorSessionId> --json
```

These commands call the platform control-plane API (`GET /api/v1/projects/:id/sessions`).

## Development

```bash
npm ci
npm run test:ci
node dist/cli.js --help
```

**Contributing:** every new command, setting key, or API field needs Vitest coverage in the same PR (`src/**/*.test.ts`). See workspace rule `feature-tests-required.mdc` in the development repo.

Credentials path override for tests:

```bash
export VOICETHERE_CREDENTIALS_PATH=/tmp/voicethere-credentials.json
```

## License

MIT — see [LICENSE](./LICENSE).
