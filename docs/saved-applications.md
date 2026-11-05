# Saved applications

Accounts and PostgreSQL were implemented before this change. Inspection found server-side Spring Security sessions, CSRF protection, PBKDF2 account hashes, environment-driven JDBC configuration, and Flyway V1. The installed PostgreSQL service accepted connections; all 13 existing backend tests passed before application storage was added. No project AGENTS.md files were found.

## Setup

Follow [accounts setup](accounts-setup.md) to supply `SPRING_PROFILES_ACTIVE=local`, `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` and start the backend with `backend\mvnw.cmd spring-boot:run`. Use the existing database and its migration history. Flyway automatically applies **V2__create_applications.sql** on startup; do not run it manually or change V1. Start the frontend with `npm start` in `frontend` and open http://localhost:4200.

Sign in, fill in the required application details, optionally preview/edit documents, then choose **Save application**. Use **My applications** to page through saved drafts and **Open** to restore all sources and edited documents without regenerating them. **Update application** saves the latest editor contents. **New application** starts a separate draft. Opening/replacing unsaved work and deleting a saved draft require confirmation. Deleting an open draft retains its editor contents as an unsaved new draft.

Save requests capture a snapshot. Changes typed while saving stay in the editor and remain marked unsaved. Errors, expired sessions, and version conflicts preserve current work. A successful logout clears source text, previews, list metadata, saved identity, and private feedback from the interface. Signing in as a different account also clears the previous account's work. Application content stays in page memory until explicitly saved; no localStorage is used.

## API

All endpoints require the authenticated session; mutations also require Angular's existing CSRF cookie/header pair. Ownership is resolved from the principal's email through `app_user`. Submitted owner/user IDs have no role in ownership. Foreign and missing application IDs both return 404 on reads, updates, and deletes. Responses use Spring Security's cache prevention headers.

| Method and path | Contract |
| --- | --- |
| `POST /api/applications` | Create; 201 with saved draft, server UUID, version 0 and timestamps |
| `GET /api/applications?page=0&size=20` | Current user's metadata only: `{items,page,size,total}`; newest update first, UUID tie-breaker |
| `GET /api/applications/{id}` | Full owned draft, including saved edited documents |
| `PUT /api/applications/{id}` | Replace editable fields using required current `version`; returns incremented version |
| `DELETE /api/applications/{id}?version=0` | Delete using the listed version; 204 success |

Create/update JSON fields: `jobTitle` and `company` (nonblank, max 150 each), `language` (`English` or `German`), `sourceCv` and `jobDescription` (nonblank, max 30,000 each), `includeLetter` (boolean), `motivation` (max 3,000; nonblank when including a letter), `editedCv` (max 60,000; may be empty before preview), `editedLetter` (nullable, max 60,000), and `demo` (must be true in the current demo-only product). `version` is required on update. Created/updated timestamps, UUID and ownership are assigned by the server. Pagination accepts page 0–1,000,000 and size 1–100; Angular uses size 10.

Invalid payloads/parameters return 400; missing authentication returns 401 with a valid CSRF token; missing/invalid CSRF returns 403; unavailable draft IDs return 404; stale versions return 409. Conditional updates/deletes include both owner and version in their SQL predicates. Concurrent writers cannot both update the same version. Fixed validation responses do not reflect or log documents. Do not enable HTTP-body, JDBC binding, or database parameter logging in deployments.

## Verification

```powershell
# Default isolated H2 suite. The PostgreSQL-only restart test is skipped.
Set-Location C:\Users\rayen\Desktop\ai-application-assistant\backend
.\mvnw.cmd test

# Real PostgreSQL suite, including closing and restarting the backend.
# Creates a fresh synthetic cluster under ignored backend/target/, then stops it.
.\test-postgres.ps1
# Optional: -PostgresBin 'C:\path\to\PostgreSQL\bin' -Port 55434

Set-Location C:\Users\rayen\Desktop\ai-application-assistant\frontend
npm test -- --watch=false
npm run build
```

The PostgreSQL helper uses a random temporary password with SCRAM authentication, binds only to IPv4 loopback, and restores prior test environment variables. It never uses the installed service's database. The stopped cluster contains synthetic data only and is retained under `target/` for inspection. Alternatively set `TEST_DB_URL`, `TEST_DB_USERNAME`, `TEST_DB_PASSWORD` for a dedicated disposable database; never use production or normal account data.

Backend coverage includes create/list/reopen/update/delete, both document fields, timestamps, pagination and validation limits, unauthenticated access and CSRF, injected user IDs, direct foreign-ID reads/updates/deletes, stale update/delete versions, two simultaneous writers, and persisted edited content after the backend closes and restarts. Existing account, upload, analysis, and PDF tests remain. Frontend tests cover current editor snapshots, edits during saves, failures/expiry/conflicts, confirmations, list pagination, logout/account switches, delayed responses, unsaved work, and rendered metadata.

Results on November 5, 2026:

- PostgreSQL 18.6: 18 backend tests passed, including restart persistence and simultaneous version conflicts; the isolated cluster was stopped afterward.
- Default H2 configuration: 17 backend tests passed; the PostgreSQL-only restart test was skipped as intended.
- Angular: 28 tests passed across three test files.
- Angular production build passed; component CSS is 8.61 kB and still produces the existing 4 kB warning.
- `git diff --check` passed. Source inspection found no localStorage use or document logging in the added implementation.

## Changed files

- `backend/src/main/resources/db/migration/V2__create_applications.sql`: application schema, foreign key and owner/list index.
- `backend/src/main/java/com/rayen/backend/ApplicationController.java`: validated, owner-scoped, versioned CRUD and safe errors.
- `backend/src/test/java/com/rayen/backend/ApplicationIntegrationTests.java`: HTTP lifecycle, isolation, validation and concurrency tests.
- `backend/src/test/java/com/rayen/backend/ApplicationRestartTests.java`: real PostgreSQL persistence across backend shutdown/restart.
- `backend/test-postgres.ps1`: isolated PostgreSQL verification helper.
- `frontend/src/app/applications.ts`: storage request/response types.
- `frontend/src/app/applications.spec.ts`: storage and private-state tests.
- `frontend/src/app/app.ts`, `app.html`, `app.scss`: save/list/open/update/delete controls, confirmations, request state and cleanup.
- `frontend/src/app/auth.ts`: explicit logout cleanup notification.
- `README.md`, `docs/accounts-setup.md`, `docs/saved-applications.md`: setup and behavior documentation.

## Remaining limits

- Saving is explicit; unsaved work is held only in page memory. The browser warns before leaving but cannot guarantee recovery after a crash.
- Version conflicts preserve edits and require reviewing/copying them before reopening the newer saved draft; automatic merging is not implemented.
- Server sessions remain in memory and restart signs users out; persisted drafts remain available after signing in again.
- PostgreSQL stores document text. Encryption at rest, backups/retention, and operational privacy controls depend on deployment setup. Uploaded PDF binaries and original layout are not stored.
- Existing account launch limitations (email verification, password reset, abuse controls) still apply. No AI or payment features were added.
- The existing 4 kB component stylesheet warning remains; the stylesheet stays below the unchanged 10 kB build error limit. Full manual browser, physical-device and assistive-technology audits remain outside these automated checks.

No commits or pushes were made.
