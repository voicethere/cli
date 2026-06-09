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

## Quickstart

Build your agent bundle locally:

```bash
npm install @voicethere/agent
npx @voicethere/agent build
```

Log in with your API key (stored in `~/.config/voicethere/credentials.json`, mode `0600`):

```bash
voicethere login --api-key vth_dev_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# optional staging/local override:
voicethere login --api-key "$VOICETHERE_API_KEY" --api-base http://localhost:3000/api/v1
```

Create a project and upload the bundle:

```bash
voicethere projects create --name "My Voice Agent"
voicethere projects list

voicethere build validate --file dist/agent.js
voicethere build upload --project <project-id> --file dist/agent.js
```

Default API base: `https://app.voicethere.dev/api/v1`

## Commands

| Command                                                    | Description                                        |
| ---------------------------------------------------------- | -------------------------------------------------- |
| `login --api-key <key> [--api-base <url>]`                 | Save credentials                                   |
| `projects list`                                            | List org projects                                  |
| `projects create --name <name> [--slug <slug>]`            | Create project                                     |
| `build validate [--file dist/agent.js]`                    | Run `@voicethere/agent verify --no-build --bundle` |
| `build upload --project <id> [--file …] [--skip-validate]` | Validate then multipart upload                     |

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
