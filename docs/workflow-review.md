# Workflow review — 2026-11-03

Inspected the frontend, backend, existing tests, build configuration, and frontend README. No AGENTS.md instructions were found in the project or checked ancestor directories. No AI integration, commits, or pushes were added.

## Verified in the browser

- Manual CV, job title, company, job description, and language entry.
- CV-only English preview and German CV plus motivation-letter preview, with clear demo notices.
- Required motivation validation when the letter is selected; incomplete forms disable preview.
- Editing both previews, copying both latest edits, and reading back exact clipboard text.
- Both PDF download actions completed. Re-uploading both downloaded PDFs extracted their latest edits, demo headers, and German characters.
- German characters exercised: äöü ÄÖÜ ß €, Grüße, Köln, and an em dash.
- Text-based PDF upload populated the editable CV and displayed the extraction notice.
- Mobile viewport inspection showed a single-column layout and no horizontal overflow (360 CSS-pixel content width). Job-title Tab navigation reached company; visible focus styling was present.
- Backend was actually stopped. Preview failure displayed retry guidance, updated the connection badge, and retained all form inputs and both edited drafts. Backend was restarted afterward.
- An offline export exposed a generic network-message bug; fixed and regression-tested afterward.

## Automated checks

- Frontend production build passed, with an existing component stylesheet budget warning (7.95 kB versus 4 kB).
- Frontend: 12 tests passed, including request fields/languages/document combinations, unsaved-edit accept/cancel, validation, clipboard handling, uploads, latest-edit export payloads, and network failures preserving drafts.
- Backend: 10 tests passed, including real servlet multipart limits and preflight responses for every API, request validation, extraction failures, English/German PDF text, embedded fonts, wrapping, pagination, rendering, and clipping bounds.
- git diff --check passed.

## Bugs fixed

1. Global upload CORS filter consumed preflights for other API routes without returning CORS headers, blocking real browser preview/export requests. Configured all API routes and added real-server regression coverage.
2. Regenerating a preview erased edited drafts before the request succeeded. Retain them until a successful response; disable preview editing during regeneration.
3. Backend connection status stayed connected after subsequent network failures. Update on API failures and recovery.
4. Generic network messages could replace helpful upload/export fallback guidance. Only use server messages for actual HTTP responses.
5. Clipboard success could describe text that changed during an asynchronous copy. Only report success if the editor still matches the copied value.

## Remaining limitations and manual checks

- Browser tooling automatically handled confirmation dialogs, so dialog visibility and both choices need a human recheck. Automated tests verify confirmation invocation, cancellation preserving sources/drafts, and acceptance discarding the preview.
- Keyboard testing was a spot check, not a complete keyboard-only or screen-reader audit. Mobile testing used a desktop browser viewport, not a physical phone.
- Inspect both downloaded PDFs visually in a PDF viewer; automated PDF tests validate text and layout bounds.
- Source and preview text remain in memory only; refresh discards them, as the UI states. Scanned/encrypted PDFs and characters outside the bundled font remain unsupported by design.

### Short manual checklist

1. Paste a CV, then upload a text PDF; review extracted text.
2. Fill target details; preview CV-only in English and both documents in German.
3. Edit both, copy into another editor, download and open both PDFs; check latest edits and umlauts.
4. Change a source field with edited previews: cancel once, then accept; verify both outcomes.
5. Use Tab/Shift+Tab, Space, and Enter throughout; test empty/whitespace inputs and narrow phone widths.
6. Stop backend and retry preview/upload/export; confirm helpful messages and preserved text. Restart and retry.

