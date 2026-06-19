# @voicethere/cli

VoiceThere cloud CLI for API login, project management, and agent bundle upload.

Requires **Node.js 22+**.

**Release flow:** `build upload` stores a bundle in history; `build promote <buildId>` sets the active build in the control plane; `deploy` (coming later) will also roll out to cloud runners.

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

| Situation | What happens |
| --------- | -------------- |
| Config file present | `build upload`, `build list`, `build promote` use its `project_id` automatically |
| No config, interactive terminal | `projects use` shows a numbered project picker |
| No config, CI / script | Run `voicethere projects use <projectId>` once (or commit config from `projects create`) |

You do **not** need to run `projects use` on every command when the config file is already in the repo.

## Typical workflow

### 1. One-time login (per machine)

API keys live in `~/.config/voicethere/credentials.json` (mode `0600`) — **not** in your agent repo.

```bash
voicethere login --api-key vth_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# local platform dev server:
voicethere login --api-key "$VOICETHERE_API_KEY" --api-base http://localhost:3000/api/v1
```

Default API base: `https://app.voicethere.dev/api/v1`

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

**Promote** sets the **active** build in the VoiceThere control plane. It does **not** roll out to cloud runners yet — use **`voicethere deploy`** when that command ships.

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

### 8. `deploy` (coming soon)

`voicethere deploy` will **promote and roll out to cloud runners** with optional `--wait`. It is **not implemented yet**; use `build promote` today.

## Repo config (version control)

Per-agent-repo file: **`.voicethere/config.json`**

| Field                  | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `project_id`           | Active platform project UUID                         |
| `project_slug`, `name` | Human-readable metadata (optional)                   |
| `bundle`               | Default bundle path (default `dist/agent.js`)        |

**Secrets stay global:** `~/.config/voicethere/credentials.json` (from `voicethere login`).

Example: [`.voicethere/config.json.example`](./.voicethere/config.json.example)

## Commands

| Command                                        | Description                                              |
| ---------------------------------------------- | -------------------------------------------------------- |
| `login --api-key <key> [--api-base <url>]`     | Save credentials                                         |
| `projects list`                                | List org projects                                        |
| `projects create <name> [--slug <slug>]`       | Create project; uses it (writes config)                  |
| `projects use [projectId]`                     | Use project (picker or existing config when omitted)     |
| `projects show`                                | Print `.voicethere/config.json`                          |
| `projects delete [projectId] [--force]`        | Delete project + builds (type name to confirm, or `--force`) |
| `build list`                                   | Builds for the active project                            |
| `build validate [file]`                        | Sandbox verify (default bundle from config)              |
| `build upload [file] [-m <msg>]`               | Upload to active project                                 |
| `build promote [buildId]`                      | Promote on active project (picker when omitted in TTY)   |
| `deploy`                                       | **Coming soon** — promote + cloud rollout + wait         |

## Logging

Progress and resolved paths go to **stderr** as `[voicethere] …` so **stdout** stays clean for JSON/tables (scripts can pipe stdout).

| Mode | Flag / env | What you get |
| ---- | ---------- | ------------ |
| **Default** | *(always on)* | High-level steps: “Creating project…”, “Uploading bundle…”, resolved project/bundle paths |
| **Verbose** | `-v` / `--verbose` or `VOICETHERE_VERBOSE=1` | API method + path, request bodies (no secrets), response status + timing, counts |

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

## Sessions and billing

List recent voice sessions (orchestrator session id, status, billable seconds):

```bash
voicethere sessions list <projectId> --start 0 --end 50
# or with .voicethere/config.json:
voicethere sessions list --start 0 --end 50
```

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

Credentials path override for tests:

```bash
export VOICETHERE_CREDENTIALS_PATH=/tmp/voicethere-credentials.json
```

## License

MIT — see [LICENSE](./LICENSE).
