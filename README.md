# osm-simple3d-stats

Usage dashboard for osm-simple3d-editor built with [Evidence](https://evidence.dev) (OSS, `@evidence-dev/evidence` 40.x) and published to GitHub Pages.

## How it works

- `scripts/fetch.mjs` pulls changesets with `created_by=osm-simple3d-editor`, plus JOSM changesets with `hashtags=#simple3d` (added by the JOSM plugin), from the OSMCha API and appends them to `data/changesets/YYYY-MM.jsonl` (one changeset per line). Each run re-fetches the last 3 days and overwrites records by id. `data/state.json` stores the last processed date; bumping `SCHEMA` in the script re-fetches everything.
- OpenHistoricalMap: `data/ohm.jsonl` comes from osmcha.openhistoricalmap.org (`OHM_OSMCHA_TOKEN`, no tag changes there); without the token it is rebuilt from the daily changeset dump at planet.openhistoricalmap.org (needs `bzcat`). OpenGeofiction: `data/ogf.jsonl` is filled incrementally from the OGF API (`/changesets` by time window).
- The current UTC day is filtered out in `sources/osm/*.sql`: it is incomplete.
- `sources/osm/*.sql` read the JSONL with DuckDB (`read_json('data/changesets/*.jsonl')`) and become the `osm.*` tables used by `pages/*.md`.
- `.github/workflows/update.yml` runs daily (and on demand): fetch → commit data → build → deploy to Pages. The daily commit of `data/state.json` keeps the scheduled workflow from being disabled for inactivity.

## Local

```bash
echo 'OSMCHA_TOKEN=...' > .env.local
echo 'OHM_OSMCHA_TOKEN=...' >> .env.local
npm ci
npm run fetch
npm run sources
npm run dev
```

## Setup on GitHub

1. Settings → Secrets and variables → Actions → add `OSMCHA_TOKEN` and `OHM_OSMCHA_TOKEN`.
2. Settings → Pages → Source: **GitHub Actions**.
3. Actions → Update stats → Run workflow.
