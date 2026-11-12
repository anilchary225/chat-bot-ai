# Contributing to Zenoxi

Thanks for helping improve Zenoxi! This guide keeps changes consistent and easy to review.

## Setup

Follow [Development](docs/DEVELOPMENT.md) to run the backend and frontend locally.

## Workflow

1. **Branch from `main`:** `feature/<short-name>`, `fix/<short-name>` or `docs/<short-name>`.
2. **Keep changes focused:** one feature or fix per pull request.
3. **Commit messages:** imperative mood and specific, e.g. `Add Instagram unified login support`,
   `Fix stalled auth screen transition`.
4. **Open a pull request** into `main` with:
   - what changed and why
   - how you tested it (see the manual test plan in [Development](docs/DEVELOPMENT.md#manual-test-plan))
   - screenshots for UI changes (light and dark, desktop and mobile)
5. Merging to `main` deploys to production automatically (Render and Vercel), so only merge tested changes.

## Pull request checklist

- [ ] `npm run build` passes in `frontend/`
- [ ] The backend imports cleanly: `MONGODB_URI=x python -c "import app.main"` in `backend/`
- [ ] New settings are added to `config.py`, both `.env.example` files, `render.yaml` and `docs/CONFIGURATION.md`
- [ ] New or changed endpoints are documented in `docs/API.md`
- [ ] Chat endpoints use `Depends(current_user)` and `load_chat`
- [ ] No secrets, tokens or personal data in code, logs or screenshots
- [ ] User-visible changes are noted in `CHANGELOG.md` under **Unreleased**

## Code style

- **Python:** PEP 8, type hints on public functions, short docstrings that explain *why*. Keep endpoint handlers thin.
- **JavaScript/React:** function components and hooks; styles in `styles.css` using the design tokens; animations
  with Framer Motion, respecting reduced motion.
- **Docs:** plain, direct language; real examples; update docs in the same pull request as the code.

## Reporting bugs

Open a GitHub issue with steps to reproduce, the expected and actual behavior, the browser/device, and any relevant
Render log lines (with tokens removed). For security issues, follow [SECURITY.md](SECURITY.md) instead.
