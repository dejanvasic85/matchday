# matchday

A multi-tenant sports competition data service — scrapes fixtures, results and ladder
tables, and serves them via an API so multiple clubs can consume the same data.

This monorepo will contain the scraper, the API, and supporting infrastructure.

## Status

Early planning. Direction is being locked through architecture decision records before any
service code is written.

See [docs/decisions](docs/decisions/README.md).

## Background

Extracted from the `williamstownsc` project, where fixtures/results/tables were captured as
flat JSON files on disk and read directly by a single Next.js app. That worked for one club
but doesn't scale to onboarding others — hence a standalone, API-served service.
