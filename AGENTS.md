<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository workflow

- Keep changes synchronized between `origin` (`Llenoxinn/dfCTF`, the original repository) and `staging` (`ralphchr/dfctf-staging`, connected to Vercel).
- Push agreed changes to the `finalization` branch in both repositories, using the configured Git author and meaningful incremental commits.
- The repositories have separate histories. Preserve each history and copy commits with cherry-pick where necessary; do not force-push or remove repository-specific files such as the original CI workflow.
- Local `finalization` tracks `staging/finalization`; local `codex/upstream-finalization` is used for `origin/finalization`.
- Verify equivalent application changes are present in both repositories before reporting a push complete. Report any failure to update either repository.
