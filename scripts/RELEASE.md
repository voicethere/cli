# Release guide — `@voicethere/cli`

Tag-driven npm publish via [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (publish job on `release/*` tags).

## Branch vs tag naming

| Ref | Pattern | Example | Purpose |
| --- | ------- | ------- | ------- |
| **Prep branch** | `release-prep/X.Y.Z` | `release-prep/0.1.0` | PR to `main` with CHANGELOG + version |
| **Publish tag** | `release/X.Y.Z` | `release/0.1.0` | Triggers npm publish on merged `main` |

**Rule:** `package.json` version on `main` must match the tag **before** you push `release/X.Y.Z`.

## One-time setup

1. npm org member with publish rights on `@voicethere`
2. GitHub repo secret **`NPM_TOKEN`** on `voicethere/cli`

## Release (recommended)

### 1. Release prep PR

```bash
git checkout main && git pull
git checkout -b release-prep/0.1.0
# Finalize CHANGELOG.md for the version
bash scripts/ci/bump-version.sh 0.1.0
npm run test:ci
git add CHANGELOG.md package.json package-lock.json
git commit -m "chore(repo): release prep 0.1.0"
git push -u origin release-prep/0.1.0
# Open PR → main, merge when green
```

### 2. Tag on merged `main`

```bash
git checkout main && git pull
git tag release/0.1.0
git push origin refs/tags/release/0.1.0
```

### 3. Verify

```bash
npm view @voicethere/cli version
npx @voicethere/cli@0.1.0 --help
```
