# infra

Deployment/infra config. Currently: the `mday` CLI image.

## CLI image

`../Dockerfile` builds the `mday` crawler CLI. On every push to `main` touching `apps/cli`,
`packages/domain`, `packages/db`, or the Dockerfile itself, `.github/workflows/publish-cli-image.yml`
builds and pushes `ghcr.io/dejanvasic85/matchday-cli:latest` (plus a `:<sha>` tag).

### First-time setup

1. Make the GHCR package pullable from Unraid. The package inherits the repo's (private)
   visibility on first push — either:
   - GitHub → package → Package settings → Danger Zone → change visibility to public, or
   - keep it private and add a registry login in Unraid (Settings → Docker → private registry:
     server `ghcr.io`, username = GitHub username, password = a PAT with `read:packages`).
2. In Unraid's Docker tab → **Add Container**, repository `ghcr.io/dejanvasic85/matchday-cli:latest`.
3. Add the env vars from `../apps/cli/.env.example` as container variables.
4. Override the default `--help` command per invocation via the container's extra
   parameters/post-arguments field, e.g. `catalog --dry-run` or `deep-crawl --league lea_xxx`.

### Verifying the update flow

Push a change that touches the CLI, wait for the `Publish CLI image` workflow to finish, then in
Unraid's Docker tab click **Check for Updates** (or wait for its scheduled check) — the container
should show an update available, since Unraid compares the `:latest` tag's digest.

### Local testing

`docker compose -f infra/docker-compose.yml run --rm mday catalog --dry-run` (reads
`apps/cli/.env.local`, gitignored).

## Not yet decided

Cron/scheduling mechanism (thanos User Scripts vs. Ofelia) — tracked in
[#43](https://github.com/dejanvasic85/matchday/issues/43) /
[#51](https://github.com/dejanvasic85/matchday/issues/51).
