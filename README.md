# @voicethere/cli

VoiceThere cloud CLI for API login, project management, and agent bundle upload.

Requires **Node.js 22+**.

## Install

```bash
npm install -g @voicethere/cli
```

Or run without a global install:

```bash
npx @voicethere/cli <command>
```

## Typical workflow

### 1. One-time login (per machine)

API keys live in `~/.config/voicethere/credentials.json` (mode `0600`) — **not** in your agent repo.

```bash
voicethere login --api-key vth_dev_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# staging / local platform:
voicethere login --api-key "$VOICETHERE_API_KEY" --api-base http://localhost:3000/api/v1
```

Default API base: `https://app.voicethere.dev/api/v1`

### 2. New agent repo — create project and link via git

From your agent project root (where you build `dist/agent.js`):

```bash
npm install @voicethere/agent
npx @voicethere/agent build

# Creates the cloud project and writes .voicethere/config.json
voicethere projects create --name "My Voice Agent"

git add .voicethere/config.json
git commit -m "chore: link VoiceThere project"
```

`.voicethere/config.json` holds the **project id** and default **bundle** path. Commit it so teammates and CI use the same project without passing `--project` every time.

### 3. Upload a build (store artifact)

Upload **stores** a new immutable build in history — it does **not** go live yet.

```bash
voicethere build validate    # optional but recommended
voicethere build upload -m "Add Spanish greeting and fix barge-in"
```

`-m` / `--message` is like a git commit message: a short label so you can tell builds apart in `build list` and the dashboard.

`build upload` reads `project_id` and `bundle` from `.voicethere/config.json` when flags are omitted.

### 4. Deploy a build (go live)

**Deploy** activates a build — maps to the platform **promote** API. Runners and the dashboard use the **active** build only after this step.

```bash
# Promote the newest passed upload (usually your latest upload)
voicethere deploy

# Or pin a specific build id from build list
voicethere deploy --build <build-uuid>
```

List recent uploads with id, timestamp, and message:

```bash
voicethere build list
```

Typical release loop:

```bash
npx @voicethere/agent build
voicethere build upload -m "v0.2 — shorter silence timeout"
voicethere deploy
```

### 5. Clone an existing repo (config already in git)

```bash
git clone <your-agent-repo>
cd <your-agent-repo>
voicethere login --api-key "$VOICETHERE_API_KEY"

npx @voicethere/agent build
voicethere build upload
```

No `projects create` needed — the linked project travels with the repo.

### 6. Link an existing cloud project (no create)

If the project already exists in the dashboard:

```bash
voicethere projects list
voicethere projects use --project <uuid> --slug my-agent --bundle dist/agent.js
git add .voicethere/config.json && git commit -m "chore: link VoiceThere project"
```

Inspect the link anytime:

```bash
voicethere projects show
```

### 7. CI / automation

- **Credentials:** inject `VOICETHERE_API_KEY` and run `voicethere login` (or set `VOICETHERE_CREDENTIALS_PATH` in tests).
- **Project:** rely on committed `.voicethere/config.json` — no `--project` in the pipeline.
- **Override config path:** `VOICETHERE_PROJECT_CONFIG=/path/to/config.json`

```bash
voicethere login --api-key "$VOICETHERE_API_KEY"
npx @voicethere/agent build
voicethere build upload -m "$GITHUB_SHA — $GITHUB_REF_NAME" --skip-validate
voicethere deploy
```

Split upload and deploy in separate jobs if you want a human approval gate between them.

## Repo config (version control)

Per-agent-repo link file: **`.voicethere/config.json`** (safe to commit — no API keys).

| Field                  | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `project_id`           | Platform project UUID — used as default for `build upload` |
| `project_slug`, `name` | Human-readable metadata (optional)                         |
| `bundle`               | Default bundle path (default `dist/agent.js`)              |

```bash
# Link an existing cloud project
voicethere projects use --project <uuid> --slug my-agent --bundle dist/agent.js

# Override path for tests
export VOICETHERE_PROJECT_CONFIG=/path/to/config.json
```

**Secrets stay global:** `~/.config/voicethere/credentials.json` (from `voicethere login`).  
Optional gitignored overrides: `.voicethere/local.json` (reserved for future use).

Example: [`.voicethere/config.json.example`](./.voicethere/config.json.example)

## Commands

| Command                                               | Description                                        |
| ----------------------------------------------------- | -------------------------------------------------- |
| `login --api-key <key> [--api-base <url>]`            | Save credentials                                   |
| `projects list`                                       | List org projects                                  |
| `projects create --name <name> [--slug <slug>]`       | Create project; writes `.voicethere/config.json`   |
| `projects use --project <id>`                         | Link repo to existing project                      |
| `projects show`                                       | Print linked `.voicethere/config.json`             |
| `build list [--project <id>]`                         | Uploaded builds: id, time, message, active flag    |
| `build validate [--file dist/agent.js]`               | Run `@voicethere/agent verify --no-build --bundle` |
| `build upload [-m <msg>] [--project <id>] [--file …]` | Store build in history (does not deploy)           |
| `deploy [--build <id>] [--project <id>]`              | Activate a build (promote; default: newest passed) |

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

UNLICENSED — VoiceThere internal / customer tooling.
