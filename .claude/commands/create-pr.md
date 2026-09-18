---
description: Create a pull request, optionally for the issue provided as argument
allowed-tools: Bash(git:*), Bash(gh:*), Bash(pnpm:*), Bash(npm:*), Bash(node:*), Bash(python3:*), Read, Glob, Write, Edit, Skill
argument-hint: [issue-number]
---

# Create Pull Request

Create a pull request. If an issue number is provided in $ARGUMENTS, use it. If no issue is provided, continue without requiring one.

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

4. **Record a demo for user-visible frontend changes**
   - Require a demo when the diff changes user-visible behavior: injected page UI, popup / options / side-panel UI, translation output shape, interactions, routing inside extension pages, or loading and error states.
   - Do not require one for implementation-only refactors, types, tests, build or CI config, or anything with no visible effect.
   - When a demo is required, invoke the `record-extension-demo` skill. If it is unavailable, follow the prompt below with the browser tooling at hand; if faithful recording is not possible, report the limitation instead of fabricating evidence.

     ```text
     Record a concise PR demo for <feature> on the current branch against <base-branch>. Inspect the diff and the repository instructions first. Turn the behavior into captioned scenes with setup, action, assertion, and end state. Build `.output/chrome-mv3` and drive it in a fresh Chrome profile with the whole config forced from the service worker and `targetCode = 'cmn'`; prefer `microsoft-translate-default` so no API key can reach a frame. Default desktop capture to 1280x800, but choose another explicit viewport when the surface requires it (the popup is small). Gate every transition on a selector or a translated-node count rather than a fixed sleep; after the assertion succeeds, hold the state about two to three seconds. Add caption pills and click highlights marked `notranslate` without modifying extension source. For bug fixes or visual regressions, rebuild the base commit in a separate worktree and capture the same scenario on both builds; for static visual changes, include paired screenshots. Keep automation and media in the scratchpad, remove install and onboarding prelude, and measure any crop from a full-resolution frame. Visually QA the result and return the absolute MP4 path, optional GIF path, scene captions, assertion results, baseline/candidate SHAs when compared, and the functional verification summary. Exclude API keys, tokens, personal tabs, and unrelated notifications. If the environment cannot reproduce the behavior faithfully, stop and report the limitation.
     ```

   - Keep the recording in the session scratchpad. Never commit a video or GIF.
   - Treat the recording as verification evidence: do not tick **Verified through manual testing** unless both the state assertions and the visual QA passed.
   - If no demo is required, write `Not applicable — no user-visible change.` in the PR template's `## Screenshots` section.

5. **Upload the demo to GitHub attachments**
   - Use [`gh-image`](https://github.com/drogers0/gh-image) so the PR embeds a repository-scoped `user-attachments` video instead of a third-party asset host.
   - Check before uploading:

     ```bash
     gh auth status
     gh extension list | grep 'drogers0/gh-image'
     gh image --version
     ```

   - Require v1.1.0 or newer. If it is missing or outdated, tell the user to run `gh extension install drogers0/gh-image` or `gh extension upgrade gh-image` and wait. Do not install it on their behalf.
   - Never run `gh image extract-token`, pass `--token`, or handle a GitHub `user_session` cookie. The normal `gh` token is enough for a repository the current account can push to.
   - Confirm the finished recording shows no API keys, tokens, personal tabs, or unrelated information. This repository is public and uploads cannot be undone.
   - Upload the verified MP4 and capture the bare URL printed to stdout. Upload a GIF only when the destination needs one:

     ```bash
     gh image "/absolute/path/to/demo.mp4" --repo mengxi-ream/read-frog
     ```

   - Accept the result only when it is one bare `https://github.com/user-attachments/assets/...` URL. Put it inside stable markers in the `## Screenshots` section so a rerun replaces the section instead of appending a second video:

     ```markdown
     <!-- read-frog-pr-demo:start -->
     https://github.com/user-attachments/assets/...

     - Scene 1: <caption and assertion>
     - Verification: <DOM/storage check and result>
     <!-- read-frog-pr-demo:end -->
     ```

   - GitHub renders the bare video URL as an inline player. When updating an existing PR, replace exactly one marked region and leave the rest of the body unchanged. Do not re-upload a file merely because the body update failed.

6. **Add changeset record if necessary**
   - Manually add a file in `.changeset/` directory following changeset convention
   - The package name is always `@read-frog/extension`. This is a single-package workspace and changesets matches the header against the `name` in the root `package.json`; a bare `read-frog` is not a workspace package and makes the release plan fail.
   - File shape — fill in the bump level and the summary, leave the package name as written:

     ```markdown
     ---
     "@read-frog/extension": patch
     ---

     fix(subtitles): follow YouTube's own default caption track
     ```

   - Changeset summary should use conventional commit style and should match the descriptive PR title
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
   - Verify the changeset before committing: `pnpm exec changeset status` must list the expected bump under `@read-frog/extension`. A non-zero exit means the changeset is malformed and the release plan will not generate.

7. **Ensure all changes are committed**
   - Stage and commit any uncommitted changes
   - Branch should be ready for PR

8. **Push the branch to remote**
   - Run `git push -u origin <branch-name>` if needed

9. **Create PR with GitHub CLI**
   - Use `gh pr create` with:
     - A descriptive title following commit convention
     - Comprehensive PR description following the template at `.github/PULL_REQUEST_TEMPLATE.md`
     - If an issue number was provided, include it in the PR description using `Closes #<issue-number>`
     - If no issue number was provided, search for a relevant issue only if it is easy to identify; otherwise leave the issue field empty instead of blocking the workflow
     - Put the uploaded `user-attachments` URL and the demonstrated scenes in the `## Screenshots` section, inside the `read-frog-pr-demo` markers

10. **Verify the demo embed**
   - For a PR with a demo, confirm the attachment survived the body without printing the whole body:

     ```bash
     gh pr view <pr> --repo mengxi-ream/read-frog --json body -q .body | grep -c 'github.com/user-attachments/'
     ```

   - Expect at least one match. If the embed is missing, fix the PR body; do not upload the video again.

11. **Return the PR URL for easy access**
   - Also return the demo status: uploaded URL and demonstrated scenes, `not applicable`, or the exact recording/upload limitation.

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
