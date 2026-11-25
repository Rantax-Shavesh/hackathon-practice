# Project Rules
- Keep changes small, clean, and scoped to the task.
- Never hardcode API keys or secrets in frontend or committed files.
- After code changes, verify syntax/build and suggest a concise Git commit message.

cd "D:\Hackathon Practice"
@"
# Project Rules

- Keep static web files (HTML, CSS, JS, assets) clean and well-structured for Cloudflare Pages deployment (`directory: .`).
- Do not leave temporary, scratch, or broken files in the repository root.
- When asked to build or update a feature and ship it, stage (`git add .`), commit with a clear message, and push to `origin main`.
"@ | Out-File -FilePath "AGENTS.md" -Encoding utf8