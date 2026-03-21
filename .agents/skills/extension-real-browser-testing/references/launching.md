# Browser Launching

## Chromium-Family Browsers

Prefer Chrome, Edge, Chromium, or Brave when DevTools Protocol automation is needed.

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

### Launch Pattern

Use a fresh profile and load the unpacked build artifact directly.

```bash
open -na '/Applications/Microsoft Edge.app' --args \
  --remote-debugging-port=9226 \
  --user-data-dir=/tmp/ext-test-edge-profile \
  --no-first-run \
  --no-default-browser-check \
  --disable-background-networking \
  --disable-sync \
  --disable-extensions-except='/abs/path/.output/edge-mv3' \
  --load-extension='/abs/path/.output/edge-mv3' \
  http://127.0.0.1:8123/
```

Use the same pattern for Chrome, Chromium, or Brave by swapping the app path.

### Verify the Extension Loaded

Query the DevTools target list:

```bash
curl -s http://127.0.0.1:9226/json/list
```

Good signals:
- target for your test page
- service worker target like `chrome-extension://<id>/background.js`

## Firefox

Firefox may not expose the same DevTools Protocol workflow. Prefer:
- manual repro with a fresh profile
- Playwright or browser-native debugging if the environment already supports it

Still follow the same core principles:
- fresh profile
- built artifact
- verify the extension actually loaded
- collect DOM evidence, not only screenshots

## Local Repro Pages

When the bug does not require a production site, prefer a minimal local page.

Examples:
- a static HTML page served from `/tmp`
- a tiny local server bound to `127.0.0.1`

Benefits:
- removes third-party page variables
- makes selection and hover coordinates deterministic
- avoids network flakiness

## Cleanup

After testing, stop:
- browser instances started for the repro
- local test servers
- temp profiles and debugging ports if they are still active
