# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A web dashboard that shows, per tracked team member, the last door they badged into via an on-prem Avigilon Access Control Manager (ACM) server. The backend polls ACM on an interval and caches "last known location" per person; the frontend shows it with a short auto-refresh delay.

Real ACM integration (`ACM_CLIENT_MODE=live`, via `AvigilonAcmClient`) is implemented and has been verified against a live appliance - see the detailed notes under "Real Avigilon ACM integration" below before touching that file. `ACM_CLIENT_MODE=mock` (the default) runs everything against `MockAcmClient`, which simulates cardholders and access events with no network calls.

## Commands

npm workspaces monorepo: `shared`, `backend`, `frontend`. Run all commands from the repo root unless noted.

```bash
npm install                      # installs all three workspaces

npm run build                    # builds shared -> backend -> frontend, in that order
npm run build --workspace=shared # shared MUST be rebuilt after editing shared/src/types.ts -
                                  # backend/frontend import its compiled dist/, not the source

npm run dev:backend              # tsx watch, backend on :3001 (requires env vars, see below)
npm run dev:frontend             # vite dev server on :5173, proxies /api to :3001

npm run test                     # runs backend vitest suite (only workspace with tests)
npm run test --workspace=backend -- path/to/file.test.ts   # single test file
npx vitest run -t "test name"    # (from backend/) run tests matching a name pattern

npm run lint                     # eslint . --ext .ts,.tsx
npm run format                   # prettier --write .

# from backend/:
npm run db:generate              # drizzle-kit generate - regenerate SQL migration after editing schema.ts
npm run db:migrate               # apply migrations to DB_PATH
npm run db:seed                  # runs migrations, then seeds an admin user + sample roster (see below)
```

### Required environment variables (backend)

`backend/src/config/env.ts` validates env vars with zod at startup and **exits the process** if invalid. `SESSION_SECRET` (>=16 chars) is the only one with no default. Copy `.env.example` to `.env` for Docker; for local `npm run dev:backend`, export vars directly or the process will exit immediately. Useful ones for local dev:

```bash
SESSION_SECRET=dev-secret-at-least-16-chars
DB_PATH=./data/acm-tracker.db
ACM_CLIENT_MODE=mock            # or "live" (unimplemented, see above)
POLL_INTERVAL_SECONDS=30
SEED_ADMIN_USERNAME=admin       # only read by db:seed, not the server itself
SEED_ADMIN_PASSWORD=...
```

### Docker

`docker-compose.yml` builds `backend/Dockerfile` and `frontend/Dockerfile` (both multi-stage, context is repo root since they need the `shared` workspace). Requires a real `.env` at repo root (`env_file: .env` on the backend service - compose fails fast if it's missing, which is intentional). SQLite lives in the `db-data` named volume. Frontend's nginx serves the built SPA and proxies `/api/*` to the `backend` service. Verified end-to-end via `docker compose up -d` (build, login through the nginx proxy, and data surviving `down && up` against the named volume) - `db:seed` needs to be run manually once against a fresh volume (`docker compose exec -e SEED_ADMIN_USERNAME=... -e SEED_ADMIN_PASSWORD=... backend node dist/db/seed.js`), it isn't run automatically like migrations are.

- Both Dockerfiles must `COPY tsconfig.base.json` alongside `package.json`/`package-lock.json` in the build stage - `shared/tsconfig.json` extends it, and without it `tsc -p tsconfig.json` fails inside the container (`TS5083: Cannot read file '/app/tsconfig.base.json'`) even though it works fine outside Docker where the file is just already present on disk.
- `express-session` only sets the cookie's `Secure` flag when `NODE_ENV=production`. Testing the compose stack over plain `http://localhost:8080` (no TLS) requires `NODE_ENV=development` in `.env`, or login will return 200 but the browser/curl will silently refuse to persist the session cookie. A real deployment needs TLS in front (nginx cert or an existing reverse proxy) plus `NODE_ENV=production`.

## Architecture

### Workspace boundaries

- **`shared/`** - DTO types only (`shared/src/types.ts`), consumed by both backend and frontend as `@acm-tracker/shared`. It's resolved via its built `dist/`, not source, so **edits to shared types require `npm run build --workspace=shared` before backend/frontend will see them** (tsx/vite do not transpile across workspace package boundaries).
- **`backend/`** - Express API + polling scheduler + SQLite (via libSQL).
- **`frontend/`** - React SPA (Vite, React Router v7).

### Backend: layering rules

- **`acm/`** is the only code allowed to know Avigilon's real request/response shapes. Everything else depends only on the `AcmClient` interface (`authenticate`, `listCardholders`, `getRecentAccessEvents(cardholderIds, since)`). `acmClientFactory.ts` picks `MockAcmClient` or `AvigilonAcmClient` based on `ACM_CLIENT_MODE`.
- **`repositories/`** is the only code allowed to import the Drizzle client/schema directly. `services/` and `routes/` go through repositories, never raw queries - this is what would make a future Postgres swap mechanical if this ever outgrows SQLite.
- **`polling/pollService.ts`** orchestrates one poll cycle: fetch active roster from `teamMemberRepository`, pass their `acmCardholderId`s to `AcmClient.getRecentAccessEvents(cardholderIds, since)` where `since` is `sync_metadata.lastSuccessfulPollAt` (falls back to a 24h lookback on first run), match returned events back to team members by `acmCardholderId`, upsert `last_access_events` + append `access_event_history` via `accessEventRepository`, prune history older than `HISTORY_RETENTION_DAYS`, then update `sync_metadata`. `scheduler.ts` wraps this in a `setInterval` with an overlap guard (skips a tick if the previous cycle is still running). `runPollCycle()` takes an optional `AcmClient` param specifically so tests can inject a configured `MockAcmClient` or a client that throws, without touching the factory/env.
- **DB**: SQLite via `@libsql/client` + Drizzle ORM - **not** `better-sqlite3`, deliberately, because `better-sqlite3`'s native build failed on this dev machine (no MSVC toolchain, no prebuild for the Node version in use). `@libsql/client` ships prebuilt binaries and needs no compiler. `db/schema.ts` is the single source of truth for tables; after editing it, run `db:generate` to produce a new migration under `db/migrations/`, which `runMigrations()` applies automatically on backend startup (also callable directly via `db:migrate`). The build script copies `src/db/migrations/` (SQL + drizzle-kit's `meta/` folder) into `dist/db/migrations/` since `tsc` doesn't copy non-`.ts` assets - if migrations ever stop being found at runtime, check that copy step first.
- **Sessions**: a custom `LibsqlSessionStore` (`auth/libsqlSessionStore.ts`) backs `express-session`, storing sessions in the same libSQL database (`sessions` table) rather than pulling in a second native-dependent package (`connect-sqlite3`/`sqlite3`). `requireAuth` middleware protects everything under `/api` except `/api/auth/login` and `/api/health/ping`. Login timing is constant-time between "wrong password" and "user doesn't exist" via `passwordService.compareAgainstHashOrDummy`.
- **Login rate limiting**: `auth/loginRateLimiter.ts` locks a *username* out for 5 minutes after 3 failed attempts (429, checked before the password comparison even runs), independent of source IP - this app has a small fixed set of admin accounts, so protecting the credential is what matters, and IP-based limiting would be trivially bypassed by rotating IPs while also being bypassable-in-reverse (shared-IP staff networks locking each other out). State is an in-memory `Map` (resets on process restart) - intentionally not persisted to the DB to avoid a table for this; revisit if that resat-on-restart behavior ever becomes a real problem. The class takes `maxFailedAttempts`/`lockoutDurationMs` as constructor options specifically so tests can use tiny values instead of the real 3/5-minute ones.
- **Change password**: `PUT /api/auth/password` (`requireAuth`-protected, unlike `/auth/login`) takes `{ currentPassword, newPassword }`, re-verifies the current password the same way login does, and enforces a 12-character minimum on the new one. No multi-admin-account UI exists by design - this app is meant for one shared admin credential.
- **npm workspace quirk**: `drizzle-orm` is listed as a root-level `devDependency` in addition to being a `backend` dependency. Without that, `drizzle-kit` (which npm hoists to root `node_modules`) can't resolve `drizzle-orm` (which otherwise stays nested under `backend/node_modules`), and `drizzle-kit generate` fails with a misleading "Please install latest version of drizzle-orm" error. Don't remove it.

### Real Avigilon ACM integration

`AvigilonAcmClient.ts` was implemented from Avigilon's official "Access Control Manager REST API" guide (v6.44, June 2023 - the customer's own PDF, not something publicly indexed) plus live verification against a real appliance. The API's actual shape differs from what you'd assume from the plan, in ways that are easy to get wrong if re-deriving this from scratch:

- **Auth is HTTP Basic on every request.** There is no login/session endpoint - `Authorization: Basic base64(user:pass)` is sent with each call (`avigilonHttp.ts`).
- **There is no "recent access events" feed at all.** The REST API's "Events" resource (`/points.xml`) is alarm/point *definitions*, not a transaction log. The only push mechanism ("Collaborations") requires ACM-side configuration we don't control from this codebase.
- **"Last door" lives on the Token record, not the Identity record.** A person can hold multiple badges (`/identities/<cn>/tokens.xml` returns one `<token>` per badge), and each token carries its own `plasecLastdoor` (a door DN, e.g. `cn=16,ou=doors,cn=...,ou=gateways,dc=plasec`) and `plasecLasttime`. The Identity record only rolls up a MAX `plasecLasttime` across all its tokens - it does not expose `plasecLastdoor` at all, because there'd be no unambiguous single door to roll up if the person holds more than one badge.
- **Resolving a badge number requires two requests, since plain `filter=` can't reach nested attributes**: `AvigilonAcmClient.resolveIdentityCn()` uses the `adv_search_field_0=plasecInternalnumber&adv_search_val_0=<badge>` mechanism against `/identities.xml` to find the owning identity's CN (cached per badge for the process lifetime), then fetches that identity's `/tokens.xml`. A plain `/identities.xml?filter=(plasecInternalnumber=X)` LDAP filter silently returns zero results for this, because `plasecInternalnumber` lives on the nested Token object, not the Identity object being filtered.
- **A person can hold multiple active badges/tokens**, each independently tracking its own `plasecLastdoor`/`plasecLasttime` - confirmed live (a real badge-in via a second token left the first token's data completely unchanged). So `getLastEventForBadge()` doesn't just read the one token matching the roster's stored badge number - it fetches *all* tokens on the resolved identity and uses whichever has the most recent `plasecLasttime` as the person's true last-known door. The stored badge number is only the lookup key for *who the person is*, not a claim that it's their only or most-used credential.
- **`plasecLastdoor` is a DN, not a name** - resolved against a cached `/doors.xml` DN→`plasecName` map (`getDoorNameMap()`, 1-hour TTL; doors rarely change so this isn't refetched every poll cycle).
- **Timestamps are ACM's own format**, not ISO 8601: 14 digits (`YYYYMMDDHHMMSS`) followed by either `Z` or a signed 4-digit offset like `-0500` (e.g. `20260902140849-0500`). See `avigilonTimestamp.ts` - both forms were observed live on the same real record (`createTimestamp` used `Z`, `plasecLasttime` used the offset form).
- **The roster's "ACM Cardholder ID" field means a badge/token internal number** (`plasecInternalnumber`, e.g. `2558933` - what ACM's own UI calls a badge), not the identity's `plasecId` (an internal GUID in this deployment, not a human-assigned external ID as the API guide's field description might suggest). The frontend roster form/table label this "Badge Number" for that reason. Given the multi-token behavior above, it only needs to be *a* valid badge number for that person - not necessarily their primary or most-used one.
- **XML parsing** uses `fast-xml-parser` with `parseTagValue: false` (badge numbers must stay strings - the parser's default numeric auto-detection would silently strip leading zeros) and a `isArray` callback forcing `identity`/`token`/`door` tags to always parse as arrays, since a single-match response and a multi-match response are otherwise structurally different.
- **TLS**: ACM appliances typically present a self-signed cert; `ACM_TLS_REJECT_UNAUTHORIZED` (env, defaults `false`) controls Node's `https.Agent({ rejectUnauthorized })`, matching Avigilon's own sample client code (`OpenSSL::SSL::VERIFY_NONE`).
- **Anti-passback/Areas tracking being disabled system-wide** (no door had `plasecdoorApbinareaDN`/`Apboutarea`/`Apbmode` set, confirmed via `/doors.xml`) is *why* the Identity-level fields are empty in this deployment - that's a red herring to rule out with a live `/doors.xml` check before assuming a code bug if `plasecLastdoor` ever appears missing again.
- **`AvigilonAcmClient.getRecentAccessEvents` deliberately ignores the `since` parameter** and always returns each requested cardholder's current last-known event. Found via live testing: pre-filtering by `since` (which made sense for the mock's growing event log) hid a real person's real last-known door whenever it predated when they were added to the tracked roster, because ACM has no history to filter - only ever "current state." Deduping against what's already changed is `accessEventRepository.recordEventIfNewer`'s job (it compares against what's cached in *our* DB per person), not this client's.
- `getRecentAccessEvents` catches and logs per-badge failures (unresolvable badge, missing token, etc.) rather than failing the whole poll cycle - one bad roster entry shouldn't take down everyone else's dashboard row.
- No automated tests cover `AvigilonAcmClient` itself (it needs a live appliance); `MockAcmClient` is what all automated tests exercise. Verify changes to this file with a live poll against the real server, not just `npm run test`.

### Backend tests

Vitest, in `backend/test/`. Tests that touch the DB set `process.env.DB_PATH` to a fresh `mkdtempSync` temp file **and then dynamically `await import(...)`** the modules under test (rather than static top-level imports), so each test file gets an isolated database instead of sharing state with other test files or picking up a stale `env`/`db` singleton. Follow this pattern for any new test that touches `db/client.ts` transitively.

### Frontend

- `App.tsx` wires routes: `/login` (public), everything else behind `RequireAuth` (redirects to `/login` if `useAuth()` has no user) wrapped in `Layout` (nav + logout).
- `auth/AuthContext.tsx` checks `/api/auth/me` on mount to determine session state; `api/client.ts` is a thin `fetch` wrapper (`credentials: 'same-origin'`) shared by all API calls, typed against `@acm-tracker/shared` DTOs.
- `hooks/usePolling.ts` is the generic interval-fetch hook driving both the dashboard's team list and its health badge - deliberately plain polling (no WebSockets/SSE), matching the backend's own polling model against ACM.
- No frontend automated tests exist; the plan's frontend verification step is manual/browser-driven (Playwright was used ad hoc during initial development, not wired into the repo).
