---
name: extension-real-browser-testing
description: Test browser extensions in real browsers using built artifacts, unpacked installs, local repro pages, and browser DevTools automation. Use when reproducing or validating extension behavior in Chrome, Edge, Chromium, Brave, or Firefox, especially for content scripts, popups, options pages, hover/focus bugs, and browser-specific regressions.
---

# Extension Real Browser Testing

## When to Use

Apply this skill when:
- The task requires validating an extension in a real browser, not just unit tests
- The bug only reproduces after `build`, `zip`, or unpacked installation
- The issue is browser-specific or version-specific
- You need to inspect live content script DOM, shadow DOM, popup state, or DevTools targets
- You need stronger evidence than component tests or jsdom can provide

## Quick Reference

| Topic | Reference |
|-------|-----------|
| Browser discovery, launching, unpacked extension loading | [references/launching.md](references/launching.md) |
| Real-browser verification workflow and debugging heuristics | [references/workflow.md](references/workflow.md) |

## Default Workflow

1. Build the extension artifact you will actually test.
2. Confirm the build output directory and manifest exist.
3. Start a minimal local repro page when the bug does not need a third-party site.
4. Launch a fresh browser profile with the unpacked extension loaded.
5. Verify the extension really loaded before testing:
   Chromium-family: confirm the extension service worker or extension page appears in the DevTools target list.
6. Automate through DevTools when possible instead of relying on visual guesses.
7. Inspect actual DOM state after reproduction:
   open/closed attributes, mounted/unmounted, opacity, visibility, pointer-events, relatedTarget, active element.
8. Clean up temporary browser profiles, servers, and debugging processes after the run.

## Rules

- Test the built artifact that matches the user report. Do not assume `dev` behavior proves anything about `build`.
- Prefer unpacked extension installs from `.output/<browser>-mv3` or the equivalent build directory.
- Use a fresh `--user-data-dir` for browser launches so old extension state does not contaminate the result.
- Keep browser-specific fixes and conclusions scoped. Do not generalize from one browser to all browsers without evidence.
- If the issue is isolated to extension overlays or content scripts, prefer fixing the extension-local wrapper layer before touching shared primitives used by options or unrelated pages.
- Node existence alone is weak evidence. A tooltip, popover, or dialog may remain mounted while already closed. Always inspect visual state too.
- When checking close behavior, distinguish these states:
  - Trigger never received leave/blur
  - Root state never closed
  - Root closed, but visual state remained visible
- If browser automation conflicts with an already-running GUI session on macOS, relaunch with `open -na ... --args ...` to force a fresh instance.

## What to Capture

For reproducible browser bugs, collect at least:
- Browser name and version
- Extension version or build artifact path
- Whether the bug reproduces in `dev`, `build`, unpacked install, or store install
- Exact page URL or minimal repro page
- DOM evidence after reproduction
- If needed, a short event sequence: hover/focus/leave/openChange/close

## Common Pitfalls

- Testing the wrong profile and reading stale extension state
- Assuming a tooltip is still "open" just because the node still exists
- Assuming a popup is closed just because logic reported `open=false`
- Letting the tooltip or popup overlay itself become the mouse hit target during hover debugging
- Editing shared browser UI primitives when the bug is specific to extension content injected into pages
