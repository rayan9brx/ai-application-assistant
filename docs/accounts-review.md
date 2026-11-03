# Accounts implementation and validation — 2026-11-03

## Files changed

- `backend/pom.xml`: Spring Security, JDBC, PostgreSQL, Flyway, and test dependencies.
- `backend/src/main/java/com/rayen/backend/AccountController.java`: validated registration, current user, and CSRF bootstrap.
- `backend/src/main/java/com/rayen/backend/AccountRepository.java`: parameterized PostgreSQL persistence, email normalization, and UserDetailsService.
- `backend/src/main/java/com/rayen/backend/SecurityConfiguration.java`: versioned PBKDF2 hashes, form login, server sessions, CSRF SPA support, generic errors, protected APIs, and logout cookie clearing.
- `AnalysisController.java`, `CvExtractionController.java`, `PdfExportController.java`, `HealthController.java`: removed cross-origin development annotations. Removed `CvUploadConfiguration.java`; same-origin proxying replaces its CORS filter.
- `backend/src/main/resources/application.properties`, `application-local.properties`, `application-prod.properties`: environment-driven database settings, cookie/session policy, and separate loopback development/HTTPS production configuration.
- `backend/src/main/resources/db/migration/V1__create_users.sql`: account schema and unique normalized email constraint.
- `backend/.env.example`: placeholder-only environment configuration.
- `AccountIntegrationTests.java`, `ProductionCookieTests.java`, `BackendApplicationTests.java`, `CvUploadIntegrationTests.java`, `CvExtractionControllerTests.java`, `PdfExportControllerTests.java`, and `src/test/resources/application-test.properties`: authentication/security tests and adapted document regressions.
- `frontend/src/app/auth.ts`, `auth.spec.ts`: in-memory account state, same-origin CSRF lifecycle, input validation, generic errors, and tests.
- `frontend/src/app/app.ts`, `app.html`, `app.scss`, `app.spec.ts`: accessible account forms, signed-in email/logout, relative APIs, focused sign-in prompts, and document-state preservation.
- `frontend/proxy.conf.json`, `frontend/angular.json`: development proxy; raised component-style error ceiling to 10 kB for the added account styles, retaining the 4 kB warning.
- `README.md`, `docs/accounts-setup.md`, this report, and `docs/accounts-mobile.png`: setup, limitations, and browser evidence.

## Automated checks

- Frontend production build passed. Component styles still produce a warning: 8.23 kB against the existing 4 kB warning budget.
- Frontend: 17 tests passed, covering the existing document workflows, draft preservation after 401, account validation, duplicate feedback, generic login failures, Angular XSRF headers, registration/login/logout lifecycle, and password clearing.
- Backend: 13 tests passed against both the default isolated H2 PostgreSQL-compatible test database and a real isolated PostgreSQL 18.6 cluster on loopback port 55432. Existing local PostgreSQL databases were not used or changed.
- Backend coverage includes real HTTP requests through servlet security filters, registration validation, normalized duplicate email, persisted hashes, successful/failed login, current-user lookup, omitted/forged CSRF rejection, token rotation, protected processing endpoints, authenticated preview/PDF export/PDF extraction, multipart limits, logout invalidation, and production Secure/HttpOnly/SameSite cookie flags and deletion.
- Document regression tests continue to inspect actual PDF text, embedded fonts, wrapping, pagination, rendered pages, and text bounds.
- `git diff --check` passed. No commits or pushes.

## Browser checks

Used an Angular development server with the new `/api` proxy and the current backend against the isolated PostgreSQL database, using synthetic account/CV data only.

- Unauthenticated preview opened the sign-in form and preserved the entered CV, role, company, and job description.
- Registration succeeded; invalid login showed the generic error; valid login displayed the email.
- Session restoration after development reload displayed the server-authenticated user.
- Authenticated English CV-only and German two-document previews rendered successfully. Edited CV PDF downloaded successfully.
- Logout removed the displayed identity while preserving application text and an edited preview.
- A subsequent download opened sign-in and kept the latest edited draft. Focus moved to the email field.
- At a 390-pixel outer viewport (375 CSS pixels available), the account form fit without horizontal overflow. Tab moved from email to password and a visible keyboard focus ring appeared.

These browser checks complement automated tests; they are not a full accessibility audit or physical-device test. Browser upload and both clipboard actions were previously reviewed; this milestone additionally verifies authenticated PDF extraction via real HTTP integration tests.

## Limits and follow-up

Email verification and password reset are required before a public paid launch. Registration/login throttling and abuse controls, privacy/account-deletion operations, and production operational/security review also remain. Duplicate registrations intentionally return 409 and can reveal email availability; login errors do not reveal whether an account exists.

Server sessions currently live in one servlet process and expire after 30 minutes of inactivity or restart. Text and previews stay only in the open page's memory; refresh clears them. No AI integration, CV persistence, or application-history storage was added. Full screen-reader, keyboard-only, and physical-phone testing remain manual.

The temporary test backend, port-4201 Angular server, and isolated PostgreSQL cluster were stopped after validation. Follow `accounts-setup.md` to configure your own local database and restart the regular development servers with the new proxy settings.
