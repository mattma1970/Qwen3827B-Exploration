# AGENTS.md

## Git workflow
- Work happens on a local feature branch (e.g. `feature/<name>` or `fix/<name>`), created when new work starts.
- **Never push new work to `main`.** `main` is the published branch (GitHub Pages serves from it).
- When it's time to push: if the local branch has no upstream yet, create the remote branch with the same name and push to it — `git push -u origin <branch>`. Never redirect the push to `main`.
- Landing changes on `main` is a separate, explicit step (merge the reviewed branch into `main`, then push `main`).
- **Never merge a pull request without explicit user instructions.** The agent may commit and push to the feature branch and may open a PR, but must **not** merge it on its own initiative. If — and only if — the user explicitly directs the merge (e.g. "merge the PR"), the agent may run `gh pr merge` (or equivalent).
- **Pre-merge gate:** before merging, run the current app's tests and **ALL of them must pass** (for the React app: `cd pacman-react && npm test`; for vanilla changes: the `node pacman/tests/peru-*.js` suites). If any test fails, do not merge — report the failures instead.
