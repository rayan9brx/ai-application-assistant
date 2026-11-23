# CLAUDE.md

## Frontend styling

- Always use the color tokens from the global styles (`frontend/src/styles.scss`); never hardcode hex colors.
- Dark layouts get the `.theme-dark` class on their root; components then use the same tokens (`--bg`, `--surface`, `--text`…) and switch automatically.
- Score colors come only from `scoreTone()` in `frontend/src/app/score-tone.ts` (0–39 danger, 40–79 warning, 80–100 success).
- Small text never uses the bright status colors; use `--*-text` on `--*-bg`.

## Work efficiently
- Only read the files needed for the task. Don't explore or read the whole codebase.
- Don't re-read files you already know from this session.
- Make the change directly; no long plans or explanations unless I ask.
- Don't run tests or full builds unless I ask. A quick build check is fine only when you're unsure the code compiles.
- Keep the final summary to 2–3 lines: what changed and which files.