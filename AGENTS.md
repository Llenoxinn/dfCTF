<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository workflow

- Pull the current branch's upstream before starting work. Prefer `git pull --ff-only`; if there is no upstream, use the intended `origin` base explicitly. Preserve local changes; commit them before integrating overlapping updates. Rebase unpublished local commits when needed, without rewriting shared history.
- Make small, focused commits as each logical step is completed, using the configured Git author and meaningful commit messages. Avoid bundling unrelated work into one large commit.
- Use descriptive branch names such as `fix/challenge-filename-overlap`. Do not include `codex` in branch names, commit titles, or other authored labels unless the user explicitly requests it.
- Leave pushing to the user unless they explicitly ask the agent to push.
- Treat `origin` (`Llenoxinn/dfCTF`) as the working repository. The private `staging` repository is a separate Vercel deployment copy; do not discover, access, or synchronize it unless the user explicitly requests that work.
- When explicitly asked to synchronize the repositories, preserve their separate histories and copy commits with cherry-pick where necessary. Do not force-push or remove repository-specific files such as the original CI workflow. Verify equivalent application changes in both repositories and report any update failure.
- Run only checks relevant to the change. Avoid unnecessary tests, repeated verification, and lengthy status investigations.
