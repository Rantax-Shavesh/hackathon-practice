---
description: Run UI tests, check for leaked secrets, and stage Git changes
---
# Verify and Stage Workflow
1. Run the project's Playwright test suite via bash and report any failures or console errors.
2. Search the codebase with grep for hardcoded API keys (`nvapi-`, `AIza`, `sk-`, or raw tokens) and ensure `.env` is ignored.
3. Run `git status` and `git diff --stat`, then propose a clear conventional commit message (for example, `feat: ...` or `fix: ...`) without pushing yet.