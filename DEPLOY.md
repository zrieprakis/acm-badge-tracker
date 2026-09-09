# Deploying to production

How to ship a code change to the production instance at
`speedsupsrvr.hammond.k12.in.us`. Production runs prebuilt Docker images
loaded via `docker save`/`docker load` rather than building on the host -
see CLAUDE.md's Docker section for why (and for deeper infra details: cert
rotation, the volume-rename gotcha, Docker Desktop's startup-on-login
requirement).

## Before you start

- Confirm `npm run build`, `npm run test`, and `npm run lint` all pass.
- Commit your changes.
- If this deploy changes `backend/src/db/schema.ts`, see "If this deploy
  includes a schema change" below before continuing.

## 1. Build the images (dev machine)

```
docker compose build
```

Produces `acm-badge-tracker-backend:latest` and
`acm-badge-tracker-frontend:latest` - the exact tags `docker-compose.yml`
on the production host already expects.

## 2. Save them to tar files

```
docker save acm-badge-tracker-backend:latest -o acm-badge-tracker-backend.tar
docker save acm-badge-tracker-frontend:latest -o acm-badge-tracker-frontend.tar
```

## 3. Copy the tar files to the production host

Copy them however's convenient (network share, USB, etc.). No other files
need to move - `docker-compose.yml`, `.env`, and `SelfSigned/` on the
production host stay as-is unless this specific deploy changes one of them
(see below).

## 4. Load the images on the production host

```
docker load -i acm-badge-tracker-backend.tar
docker load -i acm-badge-tracker-frontend.tar
```

Docker Desktop's "Images -> Import" does the same thing if you'd rather
use the GUI.

## 5. Recreate the containers

```
docker compose up -d
```

This only recreates the `backend`/`frontend` containers - it does not
touch the `acm-badge-tracker-db-data` named volume, so existing roster and
badge history data is preserved automatically.

**Never run `docker compose down -v`** (or anything with `-v`/`--volumes`)
as part of a routine deploy - that deletes the data volume.

## 6. Verify

- `docker compose ps` - both containers show `Up`.
- Log into `https://speedsupsrvr.hammond.k12.in.us` and confirm existing
  data (roster, dashboard, history) is unaffected.
- Exercise whatever this deploy actually changed.
- `docker compose logs backend` / `docker compose logs frontend` if
  anything looks wrong.

## If this deploy includes a schema change

Migrations run automatically on backend startup (`runMigrations()`), so no
manual migration step is normally needed - just make sure you ran
`npm run db:generate --workspace=backend` and committed the generated file
under `backend/src/db/migrations/` before building the image in step 1.
Nothing else in this runbook changes.

## If this deploy changes `docker-compose.yml`, `.env`, or `SelfSigned/`

Those files live on the production host independently of the images
(`.env` and `SelfSigned/` are deliberately not baked into the images - see
CLAUDE.md). If a deploy needs to change one of them, copy the updated file
to the production host alongside the tar files and update it there
manually before step 5.
