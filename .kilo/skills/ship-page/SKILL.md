---
name: ship-page
description: Build or update static web files in the repo, verify basic syntax, and push changes to main to trigger Cloudflare Pages.
---

# Ship Page Workflow

1. Edit or create the requested HTML/CSS/JS files cleanly in the project.
2. Check that markup and links have no obvious syntax mistakes or stray temporary files.
3. Run git status and git add ., commit with a descriptive message, and run git -c credential.helper=manager push origin main.
