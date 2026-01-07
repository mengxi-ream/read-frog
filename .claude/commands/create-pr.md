---
description: Create a pull request for the issue provided as argument
allowed-tools: Bash(git:*), Bash(gh:*), Read, Glob, Write, Edit
argument-hint: [issue-number]
---

# Create Pull Request

Create a pull request for the issue: $ARGUMENTS.

## Workflow

Follow these steps:

1. **Check current git status and branch information**
   - Run `git status` and `git branch` to understand the current state

2. **Create branch if needed**
   - If no branch name is provided and we are on the main branch, create a branch based on the code changes
   - Otherwise, work on the current branch

3. **Review commit history and code differences**
   - Run `git log` and `git diff main...HEAD` to understand all changes from the main branch

4. **Add changeset record if necessary**
   - Manually add a file in `.changeset/` directory following changeset convention
   - Changeset record should match the descriptive PR title following commit convention

5. **Ensure all changes are committed**
   - Stage and commit any uncommitted changes
   - Branch should be ready for PR

6. **Push the branch to remote**
   - Run `git push -u origin <branch-name>` if needed

7. **Create PR with GitHub CLI**
   - Use `gh pr create` with:
     - A descriptive title following commit convention
     - Comprehensive PR description following the template at `.github/PULL_REQUEST_TEMPLATE.md`

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
