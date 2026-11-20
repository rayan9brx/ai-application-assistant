# ApplyCraft

Angular 22 frontend + Spring Boot 4.1 backend for one core flow: **Upload → Score → Fix → Download**.

- **Upload** a PDF or Word (.docx) CV up to 5 MB, or paste the text, plus an optional job description.
- **Score** with Claude: overall score, five category scores, what an ATS can find, job match with
  matched/missing keywords, and concrete issues.
- **Fix** each issue with AI (Accept / Reject), tailor the summary and bullets to the job, edit by
  hand, and re-score.
- **Download** an ATS-friendly PDF: one column, real text, standard section headings.

The app is **stateless**: no database, no accounts, no auth. The server parses each upload in
memory and keeps nothing. All progress lives in the browser and is mirrored to `localStorage`
on that device, so a refresh doesn't lose it; "Start over" clears it.
TODO(database): saved CVs across devices, user accounts and payments will need a database.

## Run it locally

1. Backend (Java 21). Set your key, then start it on `127.0.0.1:8080`:

   ```powershell
   $env:ANTHROPIC_API_KEY = '<your key>'
   $env:SPRING_PROFILES_ACTIVE = 'local'
   cd backend; .\mvnw.cmd spring-boot:run
   ```

2. Frontend: `npm --prefix frontend start`, then open http://localhost:4200. The dev server
   proxies `/api` to the backend.

Without `ANTHROPIC_API_KEY`, upload and PDF export still work; scoring, fixes and tailoring return
a clear "AI isn't set up" message.

## Environment variables (backend only)

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes, for AI features | Claude API key. Server-side only; never sent to the browser. |
| `SPRING_PROFILES_ACTIVE` | No | `local` for development, `prod` behind an HTTPS reverse proxy. |

Optional settings in `backend/src/main/resources/application.properties`: `app.ai.model`
(default `claude-opus-5-5`), `app.ai.effort`, `app.ai.timeout-seconds`, and the per-IP rate limits
`app.rate-limit.ai-per-10-min` (20) and `app.rate-limit.files-per-10-min` (60).

## API

| Endpoint | Body | Returns |
| --- | --- | --- |
| `POST /api/cv/extract` | multipart `file` (PDF/DOCX, ≤ 5 MB) | `{ text }`, or `{ code, message }` (e.g. `NO_TEXT` for scanned PDFs) |
| `POST /api/cv/score` | `{ cvText, jobDescription? }` | score, categories, fields, `jobMatch` (only with a job description), issues |
| `POST /api/cv/fix` | `{ cvText, jobDescription?, issue }` | `{ original, replacement, explanation, needsUserInput, found }` |
| `POST /api/cv/tailor` | `{ cvText, jobDescription }` | `{ changes[], notes[] }`; only changes whose original text is in the CV |
| `POST /api/documents/export` | `{ documentType: "cv", text }` | `application/pdf` |

AI answers use structured JSON output and are validated on the server (ranges, lengths, that
quoted text really exists in the CV) before they reach the browser. Errors are JSON
`{ message }` with text that is safe to show.

## Tests

- `cd backend; .\mvnw.cmd test`: runs against a fake Claude server, so no key or network is needed.
- `npm --prefix frontend test`

Sample fictional CVs for manual testing are in `docs/sample-cv/`.

## Production notes

Run the backend behind an HTTPS reverse proxy on the same host. The per-IP rate limits are kept in
memory (one instance); `server.forward-headers-strategy=native` makes them see the client IP from
`X-Forwarded-For` sent by the local proxy. The proxy must also serve `index.html` for unknown
paths such as `/check` and `/tools/...`.
