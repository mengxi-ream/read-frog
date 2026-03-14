---
name: create-pr
description: Create a pull request for the issue provided as argument
metadata:
  author: read-frog
  version: "1.0.0"
---

# Create Pull Request

Create a pull request for the issue: $ARGUMENTS.

## Workflow

Follow these steps:

1. **Check current git status and branch information**
   - Run `git status` and `git branch` to understand the current state

2. **Create branch if needed**
   - If no branch name is provided and we are on the main branch, create a branch based on the code changes
   - If working on a worktree, create a branch based on the worktree branch, don't change the name
   - Otherwise, work on the current branch

3. **Review commit history and code differences**
   - Run `git log` and `git diff main...HEAD` to understand all changes from the main branch

4. **Add changeset record if necessary**
   - Manually add a file in `.changeset/` directory following changeset convention
   - Changeset record should match the descriptive PR title following commit convention
   - **Versioning rules:**
     - `patch` (0.0.x) — Users barely notice
       - Bug fixes
       - Small feature enhancements (e.g., drag-and-drop reordering)
       - UI tweaks, performance optimizations
       - Refactors, code cleanup
       - i18n additions
       - Adding a single config toggle
     - `minor` (0.x.0) — Users can clearly perceive "something new"
       - Independent, complete new features (e.g., subtitle translation, TTS)
       - New AI provider support
       - Major UI overhaul (new pages/panels)
       - New user-facing configuration system (not just a single toggle)
     - `major` (x.0.0) — Users need to pay attention / adapt. **Almost never use. Must ask user for explicit approval before using.**
       - Config format incompatibility (cannot auto-migrate)
       - Removal of existing features
       - API/storage structure breaking changes
       - Fundamental migrations (e.g., Manifest V2 → V3)

5. **Ensure all changes are committed**
   - Stage and commit any uncommitted changes
   - Branch should be ready for PR

6. **Push the branch to remote**
   - Run `git push -u origin <branch-name>` if needed

7. **Create PR with GitHub CLI**
   - Use `gh pr create` with:
     - A descriptive title following commit convention
     - Comprehensive PR description following the template at `.github/PULL_REQUEST_TEMPLATE.md`
     - Search if there is relevant issue to this PR, if yes, include it in the PR description and link it using `Closes #<issue-number>` to automatically close the issue when the PR is merged

8. **Return the PR URL for easy access**

## Commit Convention

Follow these commit types:

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `build`: Build system changes
- `ci`: CI/CD changes
- `perf`: Performance improvements
- `revert`: Reverting previous commits
- `i18n`: Internationalization changes
- `ai`: AI-related features

Format: `type(scope): description`

## References

- PR Template: `.github/PULL_REQUEST_TEMPLATE.md`
- Project Guidelines: `CLAUDE.md`
