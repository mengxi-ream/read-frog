# Browser Launching

## Chromium-family browsers

Prefer Edge, Chrome, Chromium, or Brave when extension automation or DevTools Protocol access is needed.

### Discovery

Check browser binaries first instead of assuming one exists.

Typical macOS locations:
- `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`
- `/Applications/Brave Browser.app/Contents/MacOS/Brave Browser`

Typical Linux commands:
- `google-chrome`
- `microsoft-edge`
- `chromium`
- `brave-browser`

## Preferred path here: Edge + Playwright

Preferred browser for this workflow in this environment.

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
```

## Verify the MV3 worker

```js
let worker = context.serviceWorkers()[0];
if (!worker) {
  worker = await context.waitForEvent('serviceworker', { timeout: 30000 });
}
const extensionId = new URL(worker.url()).host;
```

Good signals:
- the content page is present in `context.pages()`
- the MV3 service worker is present in `context.serviceWorkers()`
- the worker URL resolves to your extension ID

## Alternative manual launch

Useful when you want a browser window plus a remote debugging port for manual inspection:

```bash
open -na '/Applications/Microsoft Edge.app' --args \
  --remote-debugging-port=9226 \
  --user-data-dir=/tmp/ext-test-edge-profile \
  --no-first-run \
  --no-default-browser-check \
  --disable-extensions-except='/abs/path/.output/chrome-mv3' \
  --load-extension='/abs/path/.output/chrome-mv3' \
  http://127.0.0.1:8123/
```

Then inspect targets with:

```bash
curl -s http://127.0.0.1:9226/json/list
```

## Why not Browserbase/browser tool?

The browser tool cannot load a local unpacked extension, so it is not suitable for this workflow.

## Why not Chrome first?

Chrome can be fine in general, but on this machine Edge was more reliable for fresh-profile unpacked-extension testing. If Chrome behaves inconsistently, switch to Edge instead of brute-forcing it.

## Local repro pages

When the bug does not require a production site, prefer a minimal local page.

Examples:
- a static HTML page served from `/tmp`
- a tiny local server bound to `127.0.0.1`

Benefits:
- removes third-party page variables
- makes reproduction coordinates deterministic
- avoids unnecessary network flakiness

## Cleanup

After testing, stop:
- browser instances started for the repro
- local test servers
- temp profiles and debugging ports if they are still active
