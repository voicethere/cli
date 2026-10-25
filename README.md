# @voicethere/cli

VoiceThere cloud CLI for API login, project management, and agent bundle upload.

**Website:** [voicethere.io](https://voicethere.io)

Requires **Node.js 22+**.

**Release flow:** `build upload` stores a bundle in history; `build promote <buildId>` sets the active build in the control plane only; `deploy --wait` promotes (if needed) and rolls out to cloud runners.

## Install

```bash
npm install -g @voicethere/cli
```

Or run without a global install:

```bash
npx @voicethere/cli --help
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

Default API base: `https://app.voicethere.io/api/v1`

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

More detail: [CLI login guide](https://app.voicethere.io/docs/cli-login) on the VoiceThere docs site.

### 2. New agent project — `voicethere init`

Scaffold a local npm workspace (sources, `package.json`, `.gitignore`) and optionally create a linked VoiceThere project in one step:

```bash
voicethere init my-agent --template echo
cd my-agent
npm install   # skipped when you pass --no-install on init
npm run verify
```

| Flag              | Behavior                                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--template <id>` | Product template from the installed `@voicethere/agent` package (default: `echo`), or `blank` for a minimal stub. Run `voicethere init --help` for the live list. |
| `--local-only`    | Write files on disk only — no login, cloud project, or source upload                                                                                              |
| `--no-install`    | Skip `npm install` after scaffolding                                                                                                                              |
| `--force`         | Overwrite when `package.json` already exists                                                                                                                      |

#### Templates

`init --template` follows the product registry in `@voicethere/agent` (plus CLI-only `blank`). When the CLI bumps its agent dependency, new product templates become available without a hardcoded allow-list.

`voicethere init --help` lists each template with its name and a one-line summary from the installed `@voicethere/agent`. If a later `@voicethere/agent` release drops a template, projects created from it keep building and deploying; `init` only offers the current list.

Sources: [github.com/voicethere/agent/tree/main/templates](https://github.com/voicethere/agent/tree/main/templates)

| Id                  | Summary                                                                      |
| ------------------- | ---------------------------------------------------------------------------- |
| `blank`             | Minimal stub (`agent.ts`) — CLI only, not in the agent package               |
| `echo`              | Voice + chat echo with TTS playback                                          |
| `echo-dc`           | Data-channel echo, no TTS                                                    |
| `voice-starter`     | Every speech event — customize `onUserSpeechFinal` for your LLM              |
| `world-sync`        | JSON pose broadcast, one in-memory agent, no Redis                           |
| `world-sync-binary` | Binary pose `ArrayBuffer` via `onDataChannelBinary`, no Redis                |
| `game-sync`         | Authoritative sim with binary snapshots; Redis when `AGENT_REDIS_URL` is set |
| `voice-showcase`    | Conversational landing demo                                                  |
| `recording-consent` | Recording consent flow                                                       |
| `positional-tts`    | Orbiting TTS with per-client `setTtsPose`                                    |
| `spatial-showcase`  | Orbit / soundboard / proximity via DataChannel commands                      |
| `webhooks`          | Inbound HMAC webhook handler, then DataChannel + speak fan-out               |
| `webhooks-redis`    | Webhooks plus a Redis atomic counter                                         |

E2e-only templates live in the same folder (`echo-smoke`, `crash`, `game-sync-smoke`, `redis-sync`, `mix-smoke`) and are **not** accepted by `init`.

Sync edits with the dashboard **Code** tab:

```bash
voicethere source push   # upload local `.ts` / `.json` sources
voicethere source pull   # download cloud workspace (does not delete extra local files)
```

### 3. New agent repo — create project and commit config (manual)

From your agent project root (where you build `dist/agent.js`):

```bash
npm install @voicethere/agent
npx @voicethere/agent build

# Creates the cloud project and uses it (.voicethere/config.json)
voicethere projects create "My Voice Agent"

git add .voicethere/config.json
git commit -m "chore: use VoiceThere project"
```

### 4. Upload a build (store artifact)

Upload **stores** a new immutable build in history — it does **not** go live yet.

```bash
voicethere build validate    # optional; uses config bundle or dist/agent.js
voicethere build upload -m "Add Spanish greeting and fix barge-in"
```

`-m` / `--message` is like a git commit message: a short label so you can tell builds apart in `build list` and the dashboard.

### 5. Promote a build (set active in control plane)

**Promote** sets the **active** build in the VoiceThere control plane only. To roll out to cloud runners, run **`voicethere deploy --wait`** (promote + cluster rollout in one step).

Pass the build UUID from **`build upload --print-id`** or **`build list`**, or omit it in an interactive terminal to pick from a list:

```bash
voicethere build list
voicethere build promote
# interactive picker when stdout is a TTY and you omit the id
```

Typical release loop:

```bash
npx @voicethere/agent build
BUILD_ID=$(voicethere build upload -m "v0.2 — shorter silence timeout" --print-id)
voicethere build promote "$BUILD_ID"
```

### 6. Clone an existing repo (config already in git)

```bash
git clone "$AGENT_REPO_URL"
cd my-agent
voicethere login --api-key "$VOICETHERE_API_KEY"

npx @voicethere/agent build
BUILD_ID=$(voicethere build upload --print-id)
voicethere build promote "$BUILD_ID"
```

No `projects use` needed — the active project travels with the repo.

### 7. Use a different cloud project

```bash
voicethere projects list
voicethere projects use "$PROJECT_ID" --slug my-agent --bundle dist/agent.js
git add .voicethere/config.json && git commit -m "chore: use VoiceThere project"
```

Re-run `voicethere projects use` with no args to confirm the current project (reads existing config).

Inspect the selection anytime:

```bash
voicethere projects show
```

### 8. CI / automation

`--print-id` writes **only** the new build UUID to stdout. Progress stays on stderr, so command substitution is safe:

```bash
BUILD_ID=$(voicethere build upload --print-id)
voicethere build promote "$BUILD_ID"
# or: voicethere deploy --wait --build-id "$BUILD_ID"
```

**With committed `.voicethere/config.json`** (typical agent repo):

```bash
voicethere login --api-key "$VOICETHERE_API_KEY"
npx @voicethere/agent build
BUILD_ID=$(voicethere build upload -m "$GITHUB_SHA — $GITHUB_REF_NAME" --skip-validate --print-id)
voicethere build promote "$BUILD_ID"
```

No `projects use` step — the config file is the active project.

**Without a config file** (one-off job cwd):

```bash
voicethere login --api-key "$VOICETHERE_API_KEY"
voicethere projects use "$PROJECT_ID"
npx @voicethere/agent build
BUILD_ID=$(voicethere build upload --skip-validate --print-id)
voicethere build promote "$BUILD_ID"
```

Other CI notes:

- **Credentials:** `VOICETHERE_CREDENTIALS_PATH` for isolated test runs
- **Config override:** `VOICETHERE_PROJECT_CONFIG=/path/to/config.json`

Split upload and promote across jobs if you want a human approval gate between them.

### 9. Deploy to cloud runners

`voicethere deploy --wait` **promotes the build (when needed) and rolls out to cloud runners**, blocking until the deployment is active (or failed).

```bash
BUILD_ID=$(voicethere build upload -m "v0.2 — shorter silence timeout" --print-id)
voicethere deploy --wait --build-id "$BUILD_ID"
```

`deploy --mode force` ends calls in progress right away (use for urgent fixes); `--mode` now rejects values other than `drain` and `force`. The default, `drain`, lets calls in progress finish on the previous version (up to 9 min).

### When a deploy fails

`deploy --wait` tells you whether the failure needs a fix from you or a ticket to us.

- **A fix in your agent.** The new version could not start because your agent threw an error while it was loading. The previous version keeps serving calls. The CLI prints the reason and the command that lists your agent logs:

  ```text
  Deploy failed: Your agent threw an error while it was loading, so the new version never started. The previous version is still serving calls. Open the agent logs to see the error, fix it, and deploy again.
  Fix your agent and deploy again. Agent logs: voicethere projects logs list --project 550e8400-e29b-41d4-a716-446655440000
  ```

- **A problem on our side.** Nothing in your agent caused it. The CLI prints the support address and the details to send with it:

  ```text
  Deploy failed: We don't have enough capacity to start your new version right now.
  This one is on our side. Email support@voicethere.io with these details:
    Deployment: 11111111-aaaa-4bbb-8ccc-000000000001
    Project: 550e8400-e29b-41d4-a716-446655440000
    Build: a1b2c3d4-0000-4000-8000-000000000000
    Code: CLUSTER_CAPACITY
    Trace id: 4bf92f3577b34da6a3ce929d0e0e4736
    Failed at (UTC): 2026-10-17T12:00:41.000Z
  ```

- **A refused deploy.** If the previous version is still finishing its calls, the deploy is turned away before anything changes. The CLI prints `Deploy refused:` and the reason. Try again later, or deploy with `--mode force` when the message says so.

Some failures are retried automatically before they count as failed. While that happens, `deploy --wait` prints one line for each attempt, for example `Retrying automatically (attempt 2 of 3): <reason>`, and keeps waiting.

In every case the command exits with code 1. `deployments show <id>` prints a `Failure:` line under the header, so you can look up the reason later. Against an older API version that sends no failure details, `deploy --wait` prints the error text it receives, as before.

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

| Command                                                                                          | Description                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login [--force] [--no-open] [--api-base <url>]`                                                 | Browser device login (default); skip if credentials still work                                                                                                                                                                     |
| `login --api-key <key> [--user-api-key <vthu>] [--api-base <url>] [--dashboard-cookie <cookie>]` | Manual key login (CI / automation); optional personal key                                                                                                                                                                          |
| `orgs list`                                                                                      | List organizations (`*` = active); requires user API key or legacy cookie                                                                                                                                                          |
| `orgs use <orgId>`                                                                               | Set active organization (persists `active_org_id` for user keys)                                                                                                                                                                   |
| `org transfer-ownership <userId>`                                                                | Transfer org ownership (owner only)                                                                                                                                                                                                |
| `account deletion preview`                                                                       | JSON preview of owned orgs + deletion job                                                                                                                                                                                          |
| `account deletion request-code`                                                                  | Email 6-digit deletion verification code                                                                                                                                                                                           |
| `account deletion confirm <code> [--wait]`                                                       | Queue account deletion; `--wait` blocks until teardown completes                                                                                                                                                                   |
| `projects list`                                                                                  | List org projects                                                                                                                                                                                                                  |
| `projects create <name> [--slug <slug>]`                                                         | Create project; uses it (writes config)                                                                                                                                                                                            |
| `projects use [projectId]`                                                                       | Use project (picker or existing config when omitted)                                                                                                                                                                               |
| `api-keys create --name <name> [--kind client] [--project-id <uuid>]`                            | Create an API key. Client keys use the linked project unless `--project-id` overrides it                                                                                                                                           |
| `projects show`                                                                                  | Print `.voicethere/config.json`                                                                                                                                                                                                    |
| `projects delete [projectId] [--force] [--wait]`                                                 | Delete project + builds (type name to confirm, or `--force`; `--wait` polls async deletion)                                                                                                                                        |
| `projects settings list`                                                                         | set Runner pool settings (warm pool, scale-down)                                                                                                                                                                                   |
| `projects session-settings list`                                                                 | set WebRTC idle timeout + crash error message (see below)                                                                                                                                                                          |
| `projects billing-settings list`                                                                 | project billing toggles and spend cap (metered/storage overage, budget cap)                                                                                                                                                        |
| `projects conversation list [--q] [--json]`                                                      | Stored voice transcripts; `--q` searches turn text or session id                                                                                                                                                                   |
| `projects conversation get <sessionId>`                                                          | Full turn timeline for one session                                                                                                                                                                                                 |
| `projects conversation search <query>`                                                           | Alias for `conversation list --q`                                                                                                                                                                                                  |
| `projects widget show`                                                                           | Embed widget draft, publish status, and CDN config URL                                                                                                                                                                             |
| `projects widget set`                                                                            | Update widget draft (preset, position, mode, theme, labels)                                                                                                                                                                        |
| `projects widget deploy [--wait]`                                                                | Publish widget config to CDN                                                                                                                                                                                                       |
| `projects logs list [--session] [--level\|--severity] [--q] [--from] [--to] [--json]`            | Searchable agent logs; use `--severity error` for session failures (dual-written)                                                                                                                                                  |
| `projects metrics overview\|sessions\|agent\|voice [--period] [--start --end] [--json]`          | Project metrics: totals, failures by reason, top agent errors, voice latency percentiles                                                                                                                                           |
| `projects voice catalog`                                                                         | show STT/TTS vendors and models                                                                                                                                                                                                    |
| `build list`                                                                                     | Builds for the active project                                                                                                                                                                                                      |
| `build validate [file]`                                                                          | Sandbox verify (default bundle from config)                                                                                                                                                                                        |
| `build upload [file] [-m <msg>] [--skip-validate] [--print-id]`                                  | Upload to active project; `--print-id` prints only the build UUID                                                                                                                                                                  |
| `build promote [buildId]`                                                                        | Promote on active project (picker when omitted in TTY)                                                                                                                                                                             |
| `deploy [--wait] [--build-id] [--mode drain\|force]`                                             | Promote (if needed) + cloud rollout; `--wait` blocks                                                                                                                                                                               |
| `deployments list [--project <id>] [--limit <n>] [--before <iso>] [--json]`                      | Recent deployments with status and duration, newest first; prints `next: --before …` for more                                                                                                                                      |
| `deployments show <deploymentId> [--project <id>] [--json]`                                      | Timeline of one deployment with UTC timestamps                                                                                                                                                                                     |
| `deployments metrics [--project <id>] [--since 24h\|7d] [--json]`                                | Sessions, failures and failure rate per deployed build                                                                                                                                                                             |
| `deploy --build-id <id> --canary-pods <n> [--routing ...] [--context-field ...]`                 | Run a build on part of the traffic (Advanced and Ultimate plans)                                                                                                                                                                   |
| `canary status\|set\|auto-abort\|promote\|abort`                                                 | Inspect and manage the running canary                                                                                                                                                                                              |
| `projects services list\|show <name>\|set <name>\|delete <name>\|rotate-token <name>`            | Manage project services (your own container images). `set` takes `--image`, `--port name:port`, `--health http:<path>:<port>\|tcp:<port>`, `--env`, `--env-from-project`, `--cpu`, `--memory`, `--run-mode`; run `deploy` to apply |
| `projects registry-credentials list\|set <name>\|delete <name>`                                  | Registry credentials for private images; `set` reads the password from stdin (`--password-stdin`)                                                                                                                                  |
| `services build <name> --push <repo:tag> [--file] [--context] [--platform]`                      | Build and push an image with local Docker buildx, then set the service to the pushed digest                                                                                                                                        |

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

BUILD_ID=$(voicethere build upload --skip-validate --print-id)
# stdout: 550e8400-e29b-41d4-a716-446655440000
# stderr: [voicethere] Uploading agent bundle
#         [voicethere] project: …
#         [voicethere] bundle: …
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

## Reconnect window

`connection.reconnectWindowSec` sets how long a dropped voice conversation is held for the client to reconnect: a whole number of seconds from 15 to 30 (default 15). A recovered conversation is billed including the interruption. An unrecovered one stops billing at the drop but holds an agent runner slot for the window. It applies on the next **`voicethere deploy --wait`**.

```bash
voicethere projects voice-advanced set connection.reconnectWindowSec 30
```

## Language switch settings

Spoken-language auto-switch and its wait behavior are advanced voice settings. They apply on the next **`voicethere deploy --wait`**. When the caller switches to a language whose models are not running yet, the runner starts them on demand and can play a short wait message in the language being left.

```bash
voicethere projects voice-advanced list
voicethere projects voice-advanced set languageId.autoSwitch.enabled true
voicethere projects voice-advanced set languageId.timing end_of_utterance
voicethere projects voice-advanced set languageId.autoSwitch.waitAudio first_utterance
voicethere projects voice-advanced set languageId.autoSwitch.waitMessage.mode immediate
voicethere projects voice-advanced set languageId.autoSwitch.waitMessage.skipWhenReady false
voicethere projects voice-advanced set languageId.autoSwitch.waitMessage.texts '{"en":"One moment, switching to your language."}'
voicethere projects voice-advanced set voice.profilesByLanguage '{"de":{"stt":"de","tts":"de-thorsten-high"}}'
```

| Key                                               | Values                                         | Default            |
| ------------------------------------------------- | ---------------------------------------------- | ------------------ |
| `languageId.timing`                               | `early`, `end_of_utterance`, `continuous`      | `early`            |
| `languageId.autoSwitch.waitAudio`                 | `buffer_replay`, `first_utterance`             | `buffer_replay`    |
| `languageId.autoSwitch.waitMessage.mode`          | `end_of_utterance`, `immediate`, `off`         | `end_of_utterance` |
| `languageId.autoSwitch.waitMessage.skipWhenReady` | bool                                           | `true`             |
| `languageId.autoSwitch.waitMessage.texts`         | JSON map of language code to text, 300 chars   | built-in texts     |
| `languageId.autoSwitch.readyMessage.minSwitchMs`  | 0–15000 ms (0 = off)                           | `2000`             |
| `languageId.autoSwitch.readyMessage.texts`        | JSON map of language code to text, 300 chars   | built-in texts     |
| `voice.profilesByLanguage`                        | JSON map of language code to `stt` / `tts` ids | `{}`               |

When a switch took at least `readyMessage.minSwitchMs` and no wait message was played, the agent says a short "Okay, let's continue in <language>." in the new voice. Set it to `0` to turn that off, or override the wording per language with `readyMessage.texts`, for example `'{"de":"Okay, machen wir auf Deutsch weiter."}'`.

`languageId.autoSwitch.waitMessage.mode` decides whether the switch may interrupt the caller: `end_of_utterance` (default) waits until the caller stops, `immediate` speaks at once and cannot be interrupted, `off` plays no wait message.

Language auto-switch (`languageId.autoSwitch.enabled`) requires VoiceThere (`voicethere`) for both speech-to-text and text-to-speech. If a project uses another vendor, the API answers `400` with `auto_switch_requires_voicethere_speech` and the CLI prints that message and exits non-zero. The built-in provider id is `voicethere`; `local-sherpa` still works as an alias in `--stt-provider` and `--tts-provider`.

`voice.expectedLanguages` no longer exists. Only the boot STT/TTS pools start warm.

## Billing settings

Per-project metered overage, conversation/agent-log overage toggles, and optional spend cap. Matches dashboard **Billing** / subscriptions permissions.

```bash
voicethere projects billing-settings --help
voicethere projects billing-settings list
voicethere projects billing-settings set metered_overage_enabled true
voicethere projects billing-settings set budget_cap_amount 50
voicethere projects billing-settings set budget_cap_amount null
```

## Deployment history

Every deploy keeps a timeline: when it was requested, when the new version took over new calls, when the previous version finished its calls, and how it ended. The timelines are kept for 90 days.

```bash
voicethere deployments list
voicethere deployments list --limit 50 --json
voicethere deployments show 11111111-aaaa-4bbb-8ccc-000000000001
```

`list` shows the project's deploys, newest first (up to 50 per page). When more exist it ends with a `next: --before <time>` line; pass that value to `--before` to read the next page. Both commands use the project from `.voicethere/config.json`, or `--project <id>`. The By column shows who started the deploy: a user's email or the name of the API key; it shows `-` when the server does not know.

```text
Started (UTC)        Build     Mode   Status     By                 Duration  Last event (UTC)
2026-10-17 12:00:00  a1b2c3d4  drain  completed  alice@example.com  2:05      2026-10-17 12:09:30
2026-10-17 10:30:00  e5f6a7b8  force  completed  ci-deploy          0:42      2026-10-17 10:30:42
next: --before 2026-10-17T10:30:00.000Z
```

`show` prints one line per step: the time in UTC, the time since the deploy was requested, and what happened. A drain deploy keeps going after it finishes, because the previous version stays up until its last call ends; its "Previous version stopped" line can arrive minutes later.

```text
11111111-aaaa-4bbb-8ccc-000000000001  build a1b2c3d4  drain  completed  started 2026-10-17 12:00:00 UTC
Requested by: alice@example.com
12:00:00 UTC  +0:00  Deploy requested                      mode=drain
12:00:02 UTC  +0:02  Rollout started                       mode=drain
12:01:40 UTC  +1:40  New version ready                     runners=2
12:01:41 UTC  +1:41  New calls go to the new version       versions=1
12:01:42 UTC  +1:42  Previous version finishing its calls  runners=2
12:02:05 UTC  +2:05  Deploy finished
12:09:30 UTC  +9:30  Previous version stopped              drained in 7:48
```

The line under the header, `Requested by: <who>`, names whoever started the deploy.

A deploy that was refused shows why, in plain words:

```text
09:00:00 UTC  +0:00  Deploy requested  mode=drain
09:00:01 UTC  +0:01  Deploy refused    The previous version is still finishing its calls. Try again when it stops, or deploy with Force.
```

Deploys from before the history was recorded have no stored steps. For those, `show` lists the request and the result and ends with `(start and end only)`.

`--json` prints the API response unchanged.

## Canary deployments

Advanced and Ultimate projects can run a new build next to the stable one. The canary gets a whole number of your plan's pods and the same share of new sessions. Calls in progress are never moved.

```bash
# Run build <id> on 1 pod; new sessions are split by pod share
voicethere deploy --build-id 11111111-aaaa-4bbb-8ccc-000000000001 --canary-pods 1 --wait

# Send sessions to the canary by a customer context field instead of by share
voicethere deploy --build-id 11111111-aaaa-4bbb-8ccc-000000000001 --canary-pods 1 \
  --routing customer-context --context-field tier

# Abort on its own above 15% failed sessions, once 30 sessions have ended
voicethere deploy --build-id 11111111-aaaa-4bbb-8ccc-000000000001 --canary-pods 1 \
  --auto-abort-rate 15 --auto-abort-min-sessions 30

voicethere canary status
voicethere canary set --pods 2
voicethere canary auto-abort --rate 10 --min-sessions 50
voicethere canary auto-abort --off
voicethere canary promote        # the canary becomes the stable build
voicethere canary abort          # new sessions go back to the stable build
voicethere deployments metrics --since 7d
```

Auto-abort is on by default. `--no-auto-abort` turns it off for a deploy. `--context-field` goes with `--routing customer-context` and is rejected otherwise. A canary deploy needs `--build-id` and the default `drain` mode. `canary promote` and `canary abort` ask for confirmation; pass `--yes` to skip the prompt, which is also required when there is no terminal.

`deployments metrics` lists, for each build that ran sessions in the window, the sessions, failed sessions, failure rate and the most common failure reasons. `--since` takes `30m`, `24h` or `7d`; the default is `24h`.

## Conversation history

Search and inspect stored STT/TTS transcripts from completed voice sessions:

```bash
voicethere projects conversation list
voicethere projects conversation list --q "inventory check" --limit 20
voicethere projects conversation search "hello world"
voicethere projects conversation get orch-session-abc123 --json
```

Use `projects session-settings set conversation_history_enabled false` to stop storing new transcripts.

## Embed widget

Configure the embeddable voice/chat widget, then publish its JSON config to the CDN:

```bash
voicethere projects widget show
voicethere projects widget set --preset pill-light --position bottom-right --mode voice
voicethere projects widget deploy --wait
```

`show` prints `public_id`, publish status, and the stable CDN URL. `set` merges only the flags you pass into the current draft. `deploy` queues a CDN publish; add `--wait` to block until `publish_status` is `published` or `failed`.

Override the CDN origin with `VOICETHERE_WIDGET_CDN_BASE` or `--cdn-base` when needed (defaults derive from your API host: `app.voicethere.io` → `cdn.voicethere.io`, `app.voicethere.dev` → `cdn.voicethere.dev`).

## Sessions and billing

List recent voice sessions (orchestrator session id, status, billable seconds):

```bash
voicethere sessions list "$PROJECT_ID" --start 0 --end 50
# or with .voicethere/config.json:
voicethere sessions list --start 0 --end 50
```

Filter failures with `--failed`, `--reason <key>` (implies `--failed`), `--from <ISO>` and `--to <ISO>`; `--json` prints the raw page:

```bash
voicethere sessions list --failed --reason AGENT_HANDLER_FAILED --from 2026-10-01T00:00:00Z --json
```

Project metrics (presets `1h|6h|24h|7d|30d|mtd`, voice `1h|6h|24h|7d`, or an explicit `--start`/`--end` window):

```bash
voicethere projects metrics sessions --period 7d
voicethere projects metrics voice --period 6h --json
```

The API returns `{ sessions, start, end, count }` (max 50 rows per page). The CLI prints a `Showing X–Y of Z sessions` footer.

After a call ends (runner keep-alive billing), fetch billable duration:

```bash
voicethere sessions billing "$SESSION_ID" --project "$PROJECT_ID"
voicethere sessions billing "$SESSION_ID" --json
```

Download session audio recording (poll until ready, then fetch signed `play_url`; storage is Opus/Ogg — use `--format` or the output extension to write WAV, MP3, or raw Opus):

```bash
voicethere sessions recording "$SESSION_ID" --project "$PROJECT_ID" --wait --output ./recording.wav
voicethere sessions recording "$SESSION_ID" --wait --output ./recording.mp3 --format mp3
voicethere sessions recording "$SESSION_ID" --wait --output ./recording.opus --format opus
voicethere sessions recording "$SESSION_ID" --wait --json
```

WAV/MP3 conversion uses a bundled `ffmpeg` binary shipped with the CLI. Override with `FFMPEG_PATH` if needed. JSON metadata always reports the API storage format (`opus`).

`voicethere sessions recording get "$SESSION_ID"` is equivalent (get is the default subcommand).

Delete a session recording:

```bash
voicethere sessions recording delete "$SESSION_ID" --project "$PROJECT_ID"
```

`--output` requires `--wait`. Default wait timeout is 120s (`--timeout-ms` or `VOICETHERE_SESSION_RECORDING_TIMEOUT_MS`).

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
