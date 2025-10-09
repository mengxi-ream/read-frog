# Create Pull Request

Create a pull request for the issue: $ARGUMENTS.

Follow these steps:

1. Check current git status and branch information
2. if no branch name is provided and we are on the main branch, then create a branch for me based on the change of the code, otherwise working on the current branch
3. Review the commit history and code differences from main branch
4. add changeset record by manually add file in `.changeset/` directory if necessary
   - follow changeset convention to add a changeset record file
   - changeset record should be the same as the descriptive PR title following commit convention
   - only add changeset for apps in `apps/` directory, don't add changeset for changes in `packages/` directory
5. Ensure all changes are committed and the branch is ready
6. Push the branch to remote if needed
7. Create a PR with:
   - a descriptive title following commit convention
   - analyze all changes to create a comprehensive PR description in the body following the PR template .github/PULL_REQUEST_TEMPLATE.md
8. Return the PR URL for easy access

Use the GitHub CLI (`gh`) for all GitHub operations. Follow the project's commit message guidelines when reviewing commits.
