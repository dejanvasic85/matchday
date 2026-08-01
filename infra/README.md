# infra

Deployment/infra config. Currently: the `mday` CLI image.

## CLI image

`../Dockerfile` builds the `mday` crawler CLI. On every push to `main` touching `apps/cli`,
`packages/domain`, `packages/db`, or the Dockerfile itself, `.github/workflows/publish-cli-image.yml`
builds and pushes `ghcr.io/dejanvasic85/matchday-cli:latest` (plus a `:<sha>` tag) to GHCR.

### Running it

Pull `ghcr.io/dejanvasic85/matchday-cli:latest` on whatever host runs scheduled jobs, set the env
vars from `../apps/cli/.env.example`, and pass a subcommand as the container args (the default
`CMD` is `--help`), e.g. `catalog --dry-run` or `deep-crawl --league lea_xxx`.

If the GHCR package is private, the host's Docker daemon needs a registry login
(`docker login ghcr.io` with a PAT that has `read:packages`) before it can pull.

### Local testing

`docker compose -f infra/docker-compose.yml run --rm mday catalog --dry-run` (reads
`apps/cli/.env.local`, gitignored).
