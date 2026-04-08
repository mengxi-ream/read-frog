---
description: Test browser extensions in a real browser using Edge + Playwright, including unpacked extension injection, runtime-message triggering, DOM debugging, and truthful screenshot capture.
allowed-tools: Bash(node:*), Bash(pnpm:*), Bash(git:*), Bash(python3:*), Bash(gh:*), Read, Glob, Write, Edit
---

# Extension Real Browser Testing

Use this skill when you need to debug or verify extension behavior in a real browser instead of guessing from unit tests or static screenshots.

## Core rules

1. Test the built artifact, not an imagined dev state.
2. Use local Playwright via `node`, not Browserbase/browser tool automation.
3. Prefer Edge on this macOS setup when Chrome behaves inconsistently.
4. Use a fresh browser profile every run.
5. Prove behavior with live DOM/runtime evidence in addition to screenshots.
6. Never present a stitched comparison graphic as if it were a raw browser screenshot.

## Workflow

### 1. Build the unpacked extension

```bash
pnpm build
```

Typical output:
```text
.output/chrome-mv3
```

### 2. Launch Edge with the unpacked extension

```js
import fs from 'node:fs';
import { chromium } from '/Users/frog/.hermes/hermes-agent/node_modules/playwright/index.mjs';

const extensionPath = '/ABS/PATH/TO/.output/chrome-mv3';
const userDataDir = '/tmp/extension-edge-profile';
fs.rmSync(userDataDir, { recursive: true, force: true });

const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  headless: false,
  viewport: { width: 1440, height: 1200 },
  args: [
    '--no-first-run',
    '--no-default-browser-check',
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

let worker = context.serviceWorkers()[0];
if (!worker) {
  worker = await context.waitForEvent('serviceworker', { timeout: 30000 });
}
const extensionId = new URL(worker.url()).host;
```

### 3. Inspect or mutate state from popup/options

Important lesson from this workflow:
- reading `chrome.storage.local` from the service-worker target was unreliable here
- opening the real popup/options extension page and evaluating `chrome.*` there was reliable

```js
await popup.goto(`chrome-extension://${extensionId}/popup.html`)
await options.goto(`chrome-extension://${extensionId}/options.html`)
```

### 4. Trigger the real extension flow

For read-frog page translation, a reliable approach was:
- open a real content page first
- locate the real content tab from the popup page
- set `language.targetCode = 'cmn'`
- set the page-translation queue slow enough that loading is visible
- send the runtime message used by the extension

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

### 5. Wait for live DOM evidence

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

Then verify completion:

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

### 6. Screenshot rules

- Keep raw before and raw after screenshots.
- If the spinner is tiny in a full-page shot, add a crop as supplemental evidence.
- A crop is not a raw screenshot.
- A stitched board is not a raw screenshot.

## Pitfalls

- Chrome can behave inconsistently for unpacked-extension automation on this machine; switch to Edge when needed.
- Do not assume service-worker evaluation can read all needed state.
- A tiny spinner can be present in a correct raw full-page screenshot while still being hard to see at first glance.
- An extension page can show an unrelated recovery-mode or config error while the target content-script flow still works; verify the real target behavior directly.
- If keyboard shortcuts are flaky in automation, trigger the equivalent runtime message or popup action instead.
