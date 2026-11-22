# CLAUDE.md

## Frontend styling

- Always use the color tokens from the global styles (`frontend/src/styles.scss`); never hardcode hex colors.
- Dark layouts get the `.theme-dark` class on their root; components then use the same tokens (`--bg`, `--surface`, `--text`…) and switch automatically.
- Score colors come only from `scoreTone()` in `frontend/src/app/score-tone.ts` (0–39 danger, 40–79 warning, 80–100 success).
- Small text never uses the bright status colors; use `--*-text` on `--*-bg`.
