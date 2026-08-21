# AGENTS.md

## Git workflow
- Work happens on a local feature branch (e.g. `feature/<name>` or `fix/<name>`), created when new work starts.
- **Never push new work to `main`.** `main` is the published branch (GitHub Pages serves from it).
- When it's time to push: if the local branch has no upstream yet, create the remote branch with the same name and push to it — `git push -u origin <branch>`. Never redirect the push to `main`.
- Landing changes on `main` is a separate, explicit step (merge the reviewed branch into `main`, then push `main`).
- **Never auto-merge a pull request.** The agent may commit and push to the feature branch and may open a PR, but the actual merge into `main` is a **manual human action**. Do not run `gh pr merge` (or equivalent) to land a PR — leave the PR open for a person to review and merge.
