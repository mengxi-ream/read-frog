Please analyze and fix the GitHub issue: $ARGUMENTS.

Read the issue with `gh issue view`, and use `gh` for all other GitHub work too.

The fix is done when a test covers the reported behaviour and both `pnpm test` and `pnpm type-check` pass. Run tests locally with `SKIP_FREE_API=true`.

Then open the PR by following `.claude/commands/create-pr.md`.
