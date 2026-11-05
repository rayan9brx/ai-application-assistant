# Accounts milestone

The Angular application uses relative `/api` URLs. Spring Security owns server-side sessions and protects preview, PDF extraction, PDF export, and saved applications. PostgreSQL stores account email, a salted/versioned PBKDF2 password hash, creation time, and explicitly saved application drafts. No CVs, letters, passwords, or session tokens are stored in localStorage. See [saved application storage](saved-applications.md) for the new migration and API.

## PostgreSQL setup on Windows

PostgreSQL 18 is already installed on this machine at `C:\Program Files\PostgreSQL\18`. If setting up another machine, install PostgreSQL from the official Windows download page: https://www.postgresql.org/download/windows/. Include the server and command-line tools, keep port 5432, and choose your own administrator password.

1. In PowerShell, check the service:

   ```powershell
   Get-Service -Name 'postgresql*'
   & 'C:\Program Files\PostgreSQL\18\bin\pg_isready.exe' -h localhost -p 5432
   ```

   If stopped, open an administrator PowerShell and run `Start-Service -Name '<service-name-from-Get-Service>'`. Do not initialize or replace an existing cluster.

2. Open psql (enter your PostgreSQL administrator password at its prompt):

   ```powershell
   & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h localhost -p 5432 -U postgres -d postgres -W
   ```

3. Inside psql, create a dedicated local development role and database. These names must be unused; if they already exist, verify their ownership before reusing them.

   ```sql
   CREATE ROLE applycraft LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
   \password applycraft
   CREATE DATABASE applycraft OWNER applycraft;
   \connect applycraft
   REVOKE CREATE ON SCHEMA public FROM PUBLIC;
   GRANT USAGE, CREATE ON SCHEMA public TO applycraft;
   \quit
   ```

   `\password` asks twice for your chosen application database password without placing it in SQL command history. Use SCRAM password authentication on the database server; do not enable trust authentication.

4. Confirm the application role can connect:

   ```powershell
   & 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h localhost -p 5432 -U applycraft -d applycraft -W -c 'SELECT current_user, current_database();'
   ```

Flyway creates `app_user` and `flyway_schema_history` automatically at the next backend startup. Do not execute migration files manually or edit an already-applied migration. Add a new numbered migration for future changes.

## Run locally

Requirements: Java 21, the project's Maven wrapper, Node/npm compatible with the existing Angular 22 project, and PostgreSQL. Stop any previous backend/frontend development process before restarting, so it loads the new security configuration and Angular proxy.

Backend terminal:

```powershell
Set-Location C:\Users\rayen\Desktop\ai-application-assistant\backend
$env:SPRING_PROFILES_ACTIVE = 'local'
$env:DB_URL = 'jdbc:postgresql://localhost:5432/applycraft'
$env:DB_USERNAME = 'applycraft'
$accountDbPassword = Read-Host 'Application database password' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $accountDbPassword).Password
.\mvnw.cmd spring-boot:run
```

Frontend terminal:

```powershell
Set-Location C:\Users\rayen\Desktop\ai-application-assistant\frontend
npm ci
npm start
```

Open http://localhost:4200. Restart `npm start` after changing `proxy.conf.json`. The Angular proxy forwards `/api/**` to `http://127.0.0.1:8080`; keep the browser on localhost consistently rather than switching between localhost and 127.0.0.1. Backend port 8080 is bound to IPv4 loopback in the local profile.

Press Ctrl+C to stop each server. Clear the process environment password when finished:

```powershell
Remove-Item Env:DB_PASSWORD
Remove-Variable accountDbPassword
```

`backend/.env.example` contains placeholders only. Spring Boot does not automatically load `.env`; set environment variables in the launching terminal or your IDE's run configuration. Never commit a filled-in credentials file.

| Variable | Purpose |
| --- | --- |
| `SPRING_PROFILES_ACTIVE` | `local` for loopback HTTP; `prod` for HTTPS deployment |
| `DB_URL` | PostgreSQL JDBC URL, database name, and any TLS options |
| `DB_USERNAME` | Dedicated database role |
| `DB_PASSWORD` | Database role password, supplied through the environment |

There are no default production credentials or embedded development passwords.

## HTTP contract and CSRF

| Method and path | Contract |
| --- | --- |
| `GET /api/auth/csrf` | Public bootstrap/refresh of `XSRF-TOKEN` cookie |
| `POST /api/auth/register` | JSON `{email, password}`; 201 success, 400 invalid, 409 duplicate/unavailable details |
| `POST /api/auth/login` | URL-encoded `email` and `password`; 200 success or generic 401 |
| `GET /api/auth/me` | `{email}` for the current session; otherwise 401 |
| `POST /api/auth/logout` | Invalidates session and clears session cookie; CSRF required |
| `POST /api/analyze`, `/api/cv/extract`, `/api/documents/export` | Authenticated session and valid CSRF required |

Passwords must contain 12–128 characters and cannot be blank. Emails are validated, stripped and lowercased; the database enforces uniqueness, including concurrent inserts. Passwords are never trimmed or lowercased. Registration does not sign the user in automatically.

Angular's built-in XSRF interceptor sends the `XSRF-TOKEN` cookie as `X-XSRF-TOKEN` on relative unsafe requests. The auth service refreshes CSRF before account requests and after login/logout. The XSRF cookie is deliberately readable by JavaScript; the session cookie is HttpOnly. A stale/missing token returns 403. A missing/expired login returns 401 when a valid CSRF token is supplied. Neither response erases entered text or document drafts; sign in and retry the action. PDF files must be selected again after a failed upload.

Spring Security's SPA CSRF integration handles plain cookie headers and token rotation: https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html#csrf-integration-javascript-spa.

## Production

Set `SPRING_PROFILES_ACTIVE=prod` and provide the three database variables through your deployment's secret/environment mechanism. Use a PostgreSQL TLS connection (`sslmode=verify-full` with the appropriate CA for a remote database). Serve the compiled Angular files and proxy `/api` through the **same HTTPS origin**. The backend listens only on 127.0.0.1; container deployments must explicitly configure a private interface and network policy.

Production session cookies are `__Host-JSESSIONID`, Secure, HttpOnly, Path=/, SameSite=Lax, and have no Domain attribute. XSRF cookies are Secure, Path=/, SameSite=Lax and readable by Angular. Logout expires the session cookie with matching production attributes. Session inactivity timeout is 30 minutes. HTTP local cookies are enabled only by explicitly choosing the `local` profile. No CORS wildcard or cross-origin credential access is enabled.

Terminate TLS at a trusted reverse proxy, keep the backend inaccessible from the public internet, and configure HTTPS redirect/HSTS at that proxy. The current implementation uses the servlet container's in-memory session store: restarting the backend signs users out. Multiple instances need sticky routing or an explicitly designed shared server-side session store. Do not enable debug request/SQL parameter logging in production.

## Checks

```powershell
# Backend: isolated H2 PostgreSQL-compatible test database; no local credentials required.
Set-Location C:\Users\rayen\Desktop\ai-application-assistant\backend
.\mvnw.cmd test

# Frontend
Set-Location C:\Users\rayen\Desktop\ai-application-assistant\frontend
npm test -- --watch=false
npm run build
```

To run the same backend suite against a real **dedicated disposable PostgreSQL test database**, set `TEST_DB_URL`, `TEST_DB_USERNAME`, and `TEST_DB_PASSWORD` before `mvnw.cmd test`. Tests insert synthetic accounts and run Flyway; never point these variables at production or your normal account database. Defaults live only in `src/test/resources/application-test.properties` and the `test` profile is for tests only.

Automated coverage includes registration validation/uniqueness/hashing, generic valid/invalid login flows, current user, CSRF omission/forgery/rotation, protected endpoints, logout invalidation, production cookie flags, upload limits, document rendering, Angular CSRF headers, auth lifecycle, and draft preservation after session expiry.

## Before a public paid launch

**Email verification and password reset are still required.** Also add login/registration throttling and abuse controls, review password policy/compromised-password checking, account deletion and privacy operations, operational monitoring/backups, and a deployment-specific security review. Duplicate registration currently has a distinct 409 response, so registration can reveal email availability; login errors remain generic. This is an accounts milestone, not a public-launch readiness claim.

Demo document generation remains explicitly labeled. There is no AI integration. Save application / Update application persists the latest draft to PostgreSQL. Unsaved text survives inline sign-in and session expiry, but refresh or navigation loses unsaved changes after a browser warning. Explicit logout clears private application data from the interface. Physical-device and full assistive-technology testing remain manual.
