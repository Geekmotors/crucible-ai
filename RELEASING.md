# Releasing crucible-ai

Releases are staged by `.github/workflows/publish.yml` when a `v*` tag is pushed, and go live only when a maintainer approves them on npmjs.com with 2FA. Nobody runs `npm publish` by hand: `publishConfig.provenance` is `true`, so a local publish fails on purpose (provenance can only be generated in CI).

## What the workflow does

1. **verify** (Node 22 and 24, no publish credentials)
   - fails unless the tag is exactly `v` + the `package.json` version
   - fails unless the tagged commit is on `main`
   - `npm ci`, lint, format check, typecheck, unit tests, build
   - `npm run verify:pack`: the tarball may contain only `dist/` (including the `crucible-ai` CLI, `dist/cli.js`), `schemas/*.md`, `schemas/crucible.config.schema.json`, `README.md`, `CHANGELOG.md`, `LICENSE` and `package.json`
2. **publish** (needs verify; GitHub environment `npm`; the only job with `id-token: write`)
   - installs npm 11.21.2 (staged publishing needs npm 11.15.0 or later and Node 22.14.0 or later)
   - `npm ci --ignore-scripts`, build, pack check again
   - `npm stage publish --provenance --access public --ignore-scripts`: the version goes to the staged queue, not live
3. **approve** (you, by hand): on npmjs.com open **crucible-ai → Staged Packages**, check the name, version and contents, and click **Approve** (2FA prompt). Or run `npm stage approve <stage-id>`. Nothing is public until you approve. Provenance is generated for staged versions the same as for direct publishes.

Authentication: npm tries Trusted Publishing (OIDC) first. If no trusted publisher matches, it falls back to the `NPM_TOKEN` secret, which reaches npm as `NODE_AUTH_TOKEN`. Every token type can stage, and staging never asks for 2FA, so a stage-only token is enough. Approval always needs a human with 2FA; neither the token nor OIDC can approve. The workflow uses no other secret.

## One-time setup

npm only lets you configure a trusted publisher on a package that already exists, so the first release is staged with a token and later releases use OIDC. Staging a package that does not exist yet creates it and publishes a public placeholder version `0.0.0-stage`; the real version stays private until you approve it.

### 1. First publish (token)

1. Sign in to npmjs.com as the account that will own `crucible-ai`, with 2FA turned on.
2. Go to **Access Tokens → Generate New Token → Granular Access Token**:
   - Permissions: **Read and write (stage only)**, packages: **All packages**. The package does not exist yet, so you cannot pick it. A stage-only token cannot put a version live, even if it leaks.
   - Expiry: as short as you like. It is only needed until Trusted Publishing is set up.
3. In GitHub, go to **Geekmotors/crucible-ai → Settings → Secrets and variables → Actions → New repository secret**. Name it `NPM_TOKEN` and paste the token. A secret on the `npm` environment also works.
4. Optional: in **Settings → Environments → `npm`** (it appears after the first workflow run, or you can create it now), add yourself as a **Required reviewer**. Every publish then waits for your approval.
5. Optional, recommended: **Settings → Rules → Rulesets → New tag ruleset** targeting `v*`, restricting creation, update and deletion to yourself, so only you can trigger a publish.
6. Cut the release as described in [Every release](#every-release) (tag `v0.1.0`).

### 2. Switch to Trusted Publishing (after the package exists)

1. On npmjs.com, open **crucible-ai → Settings → Trusted Publisher → GitHub Actions** and enter:
   - Organization or user: `Geekmotors`
   - Repository: `crucible-ai`
   - Workflow filename: `publish.yml`
   - Environment: `npm`. You can leave it blank, but if you fill it in it must match the workflow's `environment: npm`.
2. Delete the `NPM_TOKEN` GitHub secret and revoke the token on npmjs.com.
3. Recommended: under **Settings → Publishing access**, choose **Require two-factor authentication and disallow tokens**. Trusted publishing still works, and a leaked token cannot publish.
4. Optional: in the trusted publisher settings, restrict it to staging only, so `npm publish` from the workflow is rejected and only `npm stage publish` is accepted. The workflow already only stages.

Check these before tagging, or the publish fails with an auth or provenance error:

- `package.json` `repository.url` must stay `git+https://github.com/Geekmotors/crucible-ai.git`. Provenance checks it against the repository the workflow ran in.
- If you rename the workflow file or the environment, update the trusted publisher to match.
- The repository must stay public. npm provenance is only generated for public source repositories.

## Every release

1. Merge everything for the release into `main`. The README links to `blob/main/docs/...`, so the docs have to be on `main` before anyone reads the npm page.
2. Run the full e2e suite locally against real OpenRouter. CI runs only `e2e-core`. `.env.dev.local` must set `CRUCIBLE_JUDGE_KEY` to your OpenRouter key.
   ```sh
   set -a; . ./.env.dev.local; set +a
   make e2e
   ```
3. Bump the version in a PR and merge it to `main`. In the same PR, rename `## Unreleased` in `CHANGELOG.md` to the new version (the changelog ships in the tarball):
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
6. Approve the staged version on npmjs.com (**crucible-ai → Staged Packages → Approve**, 2FA) or with `npm stage approve <stage-id>`.
7. Check the result:
   - `npm view crucible-ai@0.2.0`
   - On npmjs.com, the version page shows a **Provenance** badge that links to the workflow run.
   - In a consumer project: `npm audit signatures`.

## If something goes wrong

- **Tag/version mismatch, or tag not on main.** Nothing was published. Delete the tag (`git push --delete origin v0.2.0 && git tag -d v0.2.0`), fix the cause, and tag again.
- **A gate fails in verify.** Nothing was published. Fix the problem on `main`, then move the tag the same way.
- **The publish step fails with an auth error (E401/E403/ENEEDAUTH).** Either no trusted publisher matches (wrong repo, workflow file or environment) and no `NPM_TOKEN` is set, or the token has expired or lacks write (stage) permission. Fix the setting and re-run the failed job.
- **You need to pull back a release.** npm versions are immutable, so a version number can never be reused. Publish a fixed patch version. Use `npm deprecate crucible-ai@<version> "<reason>"` for the bad one, and `npm unpublish` only within npm's 72-hour window.
