# Releasing crucible-ai

Releases are published by `.github/workflows/publish.yml` when a `v*` tag is pushed. Nobody runs `npm publish` by hand: `publishConfig.provenance` is `true`, so a local publish fails on purpose (provenance can only be generated in CI).

## What the workflow does

1. **verify** (Node 22 and 24, no publish credentials)
   - fails unless the tag is exactly `v` + the `package.json` version
   - fails unless the tagged commit is on `main`
   - `npm ci`, lint, format check, typecheck, unit tests, build
   - `npm run verify:pack`: the tarball may contain only `dist/`, `schemas/*.md`, `README.md`, `LICENSE` and `package.json`
2. **publish** (needs verify; GitHub environment `npm`; the only job with `id-token: write`)
   - installs npm 11.21.2 (trusted publishing needs npm 11.5.1 or later)
   - `npm ci --ignore-scripts`, build, pack check again
   - `npm publish --provenance --access public --ignore-scripts`

Authentication: npm tries Trusted Publishing (OIDC) first. If no trusted publisher matches, it falls back to the `NPM_TOKEN` secret, which reaches npm as `NODE_AUTH_TOKEN`. Both paths publish with provenance. The workflow uses no other secret.

## One-time setup

npm only lets you configure a trusted publisher on a package that already exists, so the first release goes out with a token and later releases use OIDC.

### 1. First publish (token)

1. Sign in to npmjs.com as the account that will own `crucible-ai`, with 2FA turned on.
2. Go to **Access Tokens → Generate New Token → Granular Access Token**:
   - Permissions: **Read and write**, packages: **All packages**. The package does not exist yet, so you cannot pick it.
   - Tick **Bypass two-factor authentication**. CI cannot answer a 2FA prompt.
   - Expiry: as short as you like (7 days is plenty).
3. In GitHub, go to **jackula83/crucible-ai → Settings → Secrets and variables → Actions → New repository secret**. Name it `NPM_TOKEN` and paste the token. A secret on the `npm` environment also works.
4. Optional: in **Settings → Environments → `npm`** (it appears after the first workflow run, or you can create it now), add yourself as a **Required reviewer**. Every publish then waits for your approval.
5. Optional, recommended: **Settings → Rules → Rulesets → New tag ruleset** targeting `v*`, restricting creation, update and deletion to yourself, so only you can trigger a publish.
6. Cut the release as described in [Every release](#every-release) (tag `v0.1.0`).

### 2. Switch to Trusted Publishing (after the package exists)

1. On npmjs.com, open **crucible-ai → Settings → Trusted Publisher → GitHub Actions** and enter:
   - Organization or user: `jackula83`
   - Repository: `crucible-ai`
   - Workflow filename: `publish.yml`
   - Environment: `npm`. You can leave it blank, but if you fill it in it must match the workflow's `environment: npm`.
2. Delete the `NPM_TOKEN` GitHub secret and revoke the token on npmjs.com.
3. Recommended: under **Settings → Publishing access**, choose **Require two-factor authentication and disallow tokens**. Trusted publishing still works, and a leaked token cannot publish.

Check these before tagging, or the publish fails with an auth or provenance error:

- `package.json` `repository.url` must stay `git+https://github.com/jackula83/crucible-ai.git`. Provenance checks it against the repository the workflow ran in.
- If you rename the workflow file or the environment, update the trusted publisher to match.
- The repository must stay public. npm provenance is only generated for public source repositories.

## Every release

1. Merge everything for the release into `main`. The README links to `blob/main/docs/...`, so the docs have to be on `main` before anyone reads the npm page.
2. Run the full e2e suite locally against real OpenRouter. CI runs only `e2e-core`.
   ```sh
   set -a; . ./.env.dev.local; set +a
   make e2e
   ```
3. Bump the version in a PR and merge it to `main`:
   ```sh
   npm version 0.2.0 --no-git-tag-version   # edits package.json and package-lock.json
   ```
4. Tag the merged commit on `main` and push only that tag:
   ```sh
   git switch main && git pull --ff-only
   git tag v0.2.0
   git push origin v0.2.0
   ```
   `git push --tags` also works, but it pushes every local tag, and any of them matching `v*` would start its own publish run. Those runs would fail the version check, but they are noise.
5. Watch **Actions → publish**. Approve the `npm` environment if you set up a reviewer.
6. Check the result:
   - `npm view crucible-ai@0.2.0`
   - On npmjs.com, the version page shows a **Provenance** badge that links to the workflow run.
   - In a consumer project: `npm audit signatures`.

## If something goes wrong

- **Tag/version mismatch, or tag not on main.** Nothing was published. Delete the tag (`git push --delete origin v0.2.0 && git tag -d v0.2.0`), fix the cause, and tag again.
- **A gate fails in verify.** Nothing was published. Fix the problem on `main`, then move the tag the same way.
- **The publish step fails with an auth error (E401/E403/ENEEDAUTH).** Either no trusted publisher matches (wrong repo, workflow file or environment) and no `NPM_TOKEN` is set, or the token has expired or lacks 2FA bypass. Fix the setting and re-run the failed job.
- **You need to pull back a release.** npm versions are immutable, so a version number can never be reused. Publish a fixed patch version. Use `npm deprecate crucible-ai@<version> "<reason>"` for the bad one, and `npm unpublish` only within npm's 72-hour window.
