# ApplyCraft

Angular 22 frontend + Spring Boot 4.1 backend for one core flow: **Upload → Score → Fix → Download**.

- **Upload** a PDF or Word (.docx) CV up to 5 MB, or paste the text, plus an optional job description.
- **Score** with Claude: overall score, five category scores, what an ATS can find, job match with
  matched/missing keywords, and concrete issues.
- **Fix** each issue with AI (Accept / Reject), tailor the summary and bullets to the job, edit by
  hand, and re-score.
- **Download** an ATS-friendly PDF: one column, real text, standard section headings.

Guests can score a CV without an account: the server parses each upload in memory and keeps
nothing, and progress is mirrored to `localStorage` on that device. **Accounts** (Supabase Auth)
can save CVs, keep a score history and open them on any device (`/dashboard`, `/settings`).

- **Auth:** Angular signs users up/in with `@supabase/supabase-js` and the *publishable* key, then
  sends the access token as `Authorization: Bearer` to the backend. Spring Security verifies it
  against the project's JWKS (ES256/RS256, issuer `<SUPABASE_URL>/auth/v1`, audience
  `authenticated`) and uses the `sub` claim as the user id.
- **Data:** Spring Boot talks to Supabase Postgres directly over JDBC (Session pooler). Flyway owns
  the schema (`backend/src/main/resources/db/migration`). Every query is scoped to the token's user
  id; another user's CV returns 404. RLS is enabled with no policies, so Supabase's public Data API
  can't read these tables.
- **Secrets** (DB password, Supabase secret key, Anthropic key) live only in the backend's
  environment or `backend/.env` (git-ignored; see `backend/.env.example`).

## Run it locally

1. Backend (Java 21). Copy `backend/.env.example` to `backend/.env` and fill in the values, then
   start it on `127.0.0.1:8080` (it reads `.env` from the directory it runs in):

   ```powershell
   cd backend; .\mvnw.cmd spring-boot:run
   ```

2. Frontend: put your Supabase project URL and publishable key in
   `frontend/src/environments/environment.development.ts` (and `environment.ts` for production
   builds), then `npm --prefix frontend start`, then open http://localhost:4200. The dev server
   proxies `/api` to the backend.

Without `ANTHROPIC_API_KEY`, upload and PDF export still work; scoring, fixes and tailoring return
a clear "AI isn't set up" message.

## Environment variables (backend only)

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes, for AI features | Claude API key. Server-side only; never sent to the browser. |
| `SPRING_PROFILES_ACTIVE` | No | `local` for development, `prod` behind an HTTPS reverse proxy. |
| `SUPABASE_URL` | Yes | `https://<project-ref>.supabase.co`; used for the JWKS and the Admin API. |
| `SUPABASE_DB_URL` | Yes | JDBC Session pooler URL, e.g. `jdbc:postgresql://aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require`. |
| `SUPABASE_DB_USER` | Yes | Session pooler user, `postgres.<project-ref>`. |
| `SUPABASE_DB_PASSWORD` | Yes | Database password. |
| `SUPABASE_SECRET_KEY` | For account deletion | `sb_secret_...`; deletes the auth user on "Delete my account". Never in the frontend. |

Optional settings in `backend/src/main/resources/application.properties`: `app.ai.model`
(default `claude-opus-5-5`), `app.ai.effort`, `app.ai.timeout-seconds`, and the per-IP rate limits
`app.rate-limit.ai-per-10-min` (20), `app.rate-limit.files-per-10-min` (60) and
`app.rate-limit.data-per-10-min` (300, account writes).

## API

| Endpoint | Body | Returns |
| --- | --- | --- |
| `POST /api/cv/extract` | multipart `file` (PDF/DOCX, ≤ 5 MB) | `{ text }`, or `{ code, message }` (e.g. `NO_TEXT` for scanned PDFs) |
| `POST /api/cv/score` | `{ cvText, jobDescription? }` | score, categories, fields, `jobMatch` (only with a job description), issues |
| `POST /api/cv/fix` | `{ cvText, jobDescription?, issue }` | `{ original, replacement, explanation, needsUserInput, found }` |
| `POST /api/cv/tailor` | `{ cvText, jobDescription }` | `{ changes[], notes[] }`; only changes whose original text is in the CV |
| `POST /api/documents/export` | `{ documentType: "cv", text }` | `application/pdf` |

Account endpoints (Bearer token required; the user id always comes from the token):

| Endpoint | Body | Returns |
| --- | --- | --- |
| `GET /api/me`, `PATCH /api/me` | `{ fullName }` for PATCH | `{ id, email, fullName, plan, createdAt }` (created on first call) |
| `DELETE /api/me` | | 204; deletes the Supabase auth user and all of the user's data |
| `GET /api/cvs`, `POST /api/cvs` | `{ title, content: { text }, jobDescription? }` | list with `lastScore` / the new CV |
| `GET`, `PUT`, `DELETE /api/cvs/{id}` | same as POST for PUT | the CV / 204 |
| `POST /api/cvs/{id}/duplicate` | | the copy |
| `GET`, `POST /api/cvs/{id}/analyses` | `{ result }` (a score from `/api/cv/score`) | history, newest first / the saved analysis |

AI answers use structured JSON output and are validated on the server (ranges, lengths, that
quoted text really exists in the CV) before they reach the browser. Errors are JSON
`{ message }` with text that is safe to show.

## Tests

- `cd backend; .\mvnw.cmd test`: runs against a fake Claude server and an in-memory H2 database
  with injected JWTs (including user-isolation checks), so no keys, Supabase or network are needed.
- `npm --prefix frontend test`

Sample fictional CVs for manual testing are in `docs/sample-cv/`.

## Production notes

Run the backend behind an HTTPS reverse proxy on the same host. The per-IP rate limits are kept in
memory (one instance); `server.forward-headers-strategy=native` makes them see the client IP from
`X-Forwarded-For` sent by the local proxy. The proxy must also serve `index.html` for unknown
paths such as `/check`, `/dashboard` and `/tools/...`. In Supabase, set the Site URL to your
domain and add `<your domain>/**` to the redirect URLs so confirmation and reset links come back.
