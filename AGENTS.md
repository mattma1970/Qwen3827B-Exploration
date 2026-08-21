# AGENTS.md

## Git workflow
- Work happens on a local feature branch (e.g. `feature/<name>` or `fix/<name>`), created when new work starts.
- **Never push new work to `main`.** `main` is the published branch (GitHub Pages serves from it).
- When it's time to push: if the local branch has no upstream yet, create the remote branch with the same name and push to it — `git push -u origin <branch>`. Never redirect the push to `main`.
- Landing changes on `main` is a separate, explicit step (merge the reviewed branch into `main`, then push `main`).
