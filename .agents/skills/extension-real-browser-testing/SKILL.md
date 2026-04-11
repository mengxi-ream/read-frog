---
name: extension-real-browser-testing
description: Test browser extensions in real browsers using built artifacts, Edge + Playwright automation, runtime-message triggering, DOM debugging, and truthful screenshot capture.
metadata:
  author: read-frog
  version: "1.1.0"
---

# Extension Real Browser Testing

Use this skill when you need to validate extension behavior in a real browser instead of guessing from unit tests, jsdom, or static screenshots.

## When to use

Apply this skill when:
- the task requires validating an extension in a real browser, not just unit tests
- the bug only reproduces after `build`, `zip`, or unpacked installation
- the issue is browser-specific or version-specific
- you need to inspect live content script DOM, shadow DOM, popup state, or service-worker targets
- you need stronger evidence than component tests or jsdom can provide
- a UI PR needs screenshots rendered from the real extension behavior

## Quick reference

| Topic | Reference |
|-------|-----------|
| Browser discovery, Edge launch patterns, unpacked extension loading | [references/launching.md](references/launching.md) |
| Real-browser verification workflow, debugging heuristics, read-frog capture recipe | [references/workflow.md](references/workflow.md) |

## General workflow

1. Build the extension artifact you will actually test.
2. Confirm the build output directory and manifest exist.
3. Start a minimal local repro page when the bug does not need a third-party site.
4. Launch a fresh browser profile with the unpacked extension loaded.
5. Verify the extension really loaded before testing.
6. Trigger the real extension flow.
7. Inspect actual DOM/runtime state after reproduction.
8. Capture screenshots only after you can prove the claimed state.
9. Clean up temporary browser profiles, servers, and debugging processes after the run.

## Rules

- Test the built artifact that matches the user report. Do not assume `dev` behavior proves anything about `build`.
- Prefer unpacked extension installs from `.output/<browser>-mv3` or the equivalent build directory.
- Use a fresh profile for every automation run so old extension state does not contaminate the result.
- Keep browser-specific fixes and conclusions scoped. Do not generalize from one browser to all browsers without evidence.
- Node existence alone is weak evidence. A tooltip, popover, or dialog may remain mounted while already closed. Always inspect visual state too.
- When screenshots are for review, raw before/after captures are the source of truth.
- Never present a stitched comparison graphic as if it were a raw browser screenshot.

## Preferred automation path on this macOS setup

For this repository and machine, Edge + local Playwright was the most reliable path for unpacked-extension automation.

Important environment lessons:
- Chrome may appear to load an unpacked extension but still behave inconsistently under automation in this environment.
- Edge worked reliably with Playwright `launchPersistentContext` and a fresh profile.
- Reading `chrome.storage.local` from the Playwright service-worker target was unreliable here.
- Opening the real popup/options extension page and evaluating `chrome.*` there was reliable.

If Chrome behaves strangely, switch to Edge instead of continuing to guess.

## Read-frog page-translation workflow

For read-frog page translation, a reliable automation path was:

1. Open a real content page first.
2. Open `chrome-extension://<id>/popup.html`.
3. From the popup page, locate the actual content tab.
4. Explicitly set config in `chrome.storage.local` instead of assuming defaults.
5. Trigger the same runtime message used by the extension in production.
6. Wait for `.read-frog-spinner` nodes and record live DOM evidence.
7. Take the raw screenshot while spinner nodes are still present.
8. Keep waiting until translated wrapper nodes contain Chinese text to prove the run was real.

Example setup from the popup page:

```js
const setup = await popup.evaluate(async ({ targetUrl }) => {
  const tab = (await chrome.tabs.query({})).find(item => item.url === targetUrl);
  if (!tab?.id) throw new Error(`Could not find tab for ${targetUrl}`);

  const current = await chrome.storage.local.get('config');
  const config = current.config ?? {};

  config.language = {
    ...(config.language ?? {}),
    sourceCode: 'auto',
    targetCode: 'cmn',
  };

  config.translate = {
    ...(config.translate ?? {}),
    providerId: 'microsoft-translate-default',
    mode: 'bilingual',
    page: {
      ...(config.translate?.page ?? {}),
      range: 'all',
    },
    requestQueueConfig: {
      ...(config.translate?.requestQueueConfig ?? {}),
      rate: 1,
      capacity: 1,
    },
    batchQueueConfig: {
      ...(config.translate?.batchQueueConfig ?? {}),
      maxItemsPerBatch: 1,
      maxCharactersPerBatch: 160,
    },
  };

  await chrome.storage.local.set({ config });

  await chrome.runtime.sendMessage({
    id: Date.now(),
    type: 'tryToSetEnablePageTranslationByTabId',
    data: { tabId: tab.id, enabled: true },
    timestamp: Date.now(),
  });

  return {
    tabId: tab.id,
    targetCode: config.language.targetCode,
  };
}, { targetUrl: page.url() });
```

Good loading-time evidence for read-frog:

```js
await page.waitForFunction(
  () => document.querySelectorAll('.read-frog-spinner').length >= 4,
  null,
  { timeout: 45000 },
);

const loadingEvidence = await page.evaluate(() => ({
  spinnerCount: document.querySelectorAll('.read-frog-spinner').length,
  sampleSpinnerStyles: Array.from(document.querySelectorAll('.read-frog-spinner'))
    .slice(0, 3)
    .map(node => node.getAttribute('style')),
}));
```

Good completion-time evidence for read-frog:

```js
await page.waitForFunction(
  () => {
    const wrappers = Array.from(document.querySelectorAll('.read-frog-translated-content-wrapper'));
    return wrappers.some(node => /[\u3400-\u9FFF]/.test(node.textContent || ''));
  },
  null,
  { timeout: 120000 },
);
```

## Screenshot policy

For UI PRs:
- keep raw before and raw after screenshots
- optionally add crops or a comparison board for reviewer convenience
- clearly label any composite as a composite built from raw screenshots

Important note from this workflow:
- a raw full-page screenshot can contain real loading spinners that are still hard to notice because they are tiny
- when reviewers need help seeing the difference, supplement the raw screenshots with zoomed crops, but do not replace the raw evidence

## What to capture

For reproducible browser bugs, collect at least:
- browser name and version
- extension build artifact path
- whether the bug reproduces in `dev`, `build`, unpacked install, or store install
- exact page URL or minimal repro page
- DOM/runtime evidence after reproduction
- screenshot paths or hosted URLs
- if needed, a short event sequence: hover/focus/leave/openChange/close

## Common pitfalls

- testing the wrong profile and reading stale extension state
- assuming a popup or tooltip is still "open" just because the node still exists
- assuming a shortcut failure proves the feature is broken, when the runtime message path may still work
- using a fake or stitched screenshot and then describing it as raw evidence
- ignoring unrelated popup errors that may coexist with a still-working content-page flow
- pushing content-script-specific workarounds into shared primitives without evidence that every surface needs them

## References

- See `references/launching.md` for exact Edge launch patterns.
- See `references/workflow.md` for the real-browser checklist, debugging heuristics, and read-frog capture recipe.
