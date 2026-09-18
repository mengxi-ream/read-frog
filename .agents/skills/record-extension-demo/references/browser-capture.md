# Browser capture reference

Read this after choosing the automation tool. In this repository the default is the Puppeteer harness from `extension-puppeteer-debugging`, because the extension must be installed with `browser.installExtension()` and configured through its service worker. Chrome DevTools MCP is fine for exploring and for stills, but a scripted recorder is what produces a repeatable video.

## Capture strategy

Prefer CDP screencast over desktop recording. It produces clean frames with no terminal windows, desktop notifications, or cursor drift, and makes viewport changes deterministic.

Write the recorder in the session scratchpad, never in the repository. `npm i puppeteer` there; Chrome comes from `~/.cache/puppeteer`.

Per scene:

1. `const cdp = await page.createCDPSession()`
2. `await cdp.send('Page.enable')`
3. Subscribe to `Page.screencastFrame`.
4. `await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth, maxHeight, everyNthFrame: 1 })` with `maxWidth`/`maxHeight` equal to the viewport.
5. Acknowledge **every** frame with `Page.screencastFrameAck({ sessionId })` — an unacked frame stalls the stream.
6. `await cdp.send('Page.stopScreencast')` in a `finally` path.
7. Remove the listener and detach the session after stopping.

A screencast only emits on repaint. On a page with nothing to scroll — a popup, an options page — nothing arrives at all, and an empty `frames.json` fails the build. Nudge a repaint at scene start (scroll by 1px and back, or toggle a class on the overlay), screenshot the viewport explicitly when no frame has arrived, and always screenshot one authoritative frame after the assertion passes. A ~6 KB frame is blank; ~50 KB is painted.

## Frame metadata

Save frames sequentially and preserve the CDP metadata timestamp:

```json
{
  "name": "01-translate-page",
  "frames": [
    { "file": "frame-00000.jpg", "timestamp": 12345.100, "sequence": 1 },
    { "file": "frame-00001.jpg", "timestamp": 12345.133, "sequence": 2 }
  ]
}
```

Use `metadata.timestamp` exactly as emitted. The assembly script converts adjacent timestamp differences into frame durations.

## Scene recording pattern

Implement one reusable recorder that accepts a scene name and an async action, creates the scene directory, starts capture, runs the action, stops capture, and writes `frames.json`:

```text
restore config and viewport
wait for extension readiness (service worker + content script + fixture selector)
start screencast
nudge a repaint; screenshot the viewport if no frame arrived
show caption pill and click highlight
perform action
wait for and assert the transition and final state
capture an authoritative final frame at screencast pixel size
stop screencast in finally
write frames.json (the builder holds the last frame for hold_last_seconds)
```

Never use a fixed sleep as a readiness condition. After an assertion succeeds, a two-to-three-second presentation hold is appropriate; encode it through captured idle frames or the manifest's `hold_last_seconds`.

If a final `Page.captureScreenshot` is used, compare its actual pixel dimensions with the screencast frames — CDP screenshots use device pixels (2× on this machine's display) while `startScreencast` honors `maxWidth`/`maxHeight`. Downsample explicitly. Never mix frame sizes inside one scene; the builder rejects it.

## Presentation overlays

- Inject overlays from the recorder with a unique data attribute, and remove them after the scene.
- **Every injected node must carry `class="notranslate"` and `translate="no"`.** Read Frog walks the DOM and will otherwise treat a caption pill as a translation unit: the pill gets translated on camera, and its nodes pollute the wrapper/anchor counts the scene asserts.
- Give overlays `pointer-events: none` so they cannot intercept the click the scene is proving, and a high `z-index` that still sits below nothing the scene needs to show.
- The injected pill is the only caption in the finished video — the builder composites nothing on top. Place it top-left by default and keep it to one line; move it only when the subject itself lives in that corner.
- Keep captions and click rings identical between baseline and candidate takes.

## Assertions

Assert extension behavior through the DOM after every scene. Choose the narrowest reliable evidence:

- bilingual mode: count `.read-frog-translated-content-wrapper`;
- translationOnly in-place swap: count `[data-read-frog-translation-only]` anchors and assert CJK (`/[一-鿿]/`) in the site's own text nodes;
- restore ("show original"): zero wrappers **and** zero `[data-read-frog-translation-only]`; `data-read-frog-walked/-paragraph/-block-node/-inline-node` labels persist by design — compare innerHTML modulo those attributes, never byte-for-byte;
- extension pages: accessible name or `data-state`/`aria-expanded` of the control that changed;
- persistence: read the key back from `chrome.storage.local` in the service worker;
- layout behavior: `boundingBox()` inside the viewport — a DOM-only assertion has shipped a video of a scroll that never happened;
- negative cases: assert the absence of the mutation.

Record assertion results separately from video frames so a visually plausible transition cannot hide a behavioral failure. Also collect `page.on('console')` and `pageerror` for `Minified React error|NotFoundError` — a clean-looking frame can hide a broken fiber tree.

## Viewports and responsive scenes

- Default desktop demos to 1280×800 unless the evidence needs another size.
- Keep the viewport and raw recording dimensions identical.
- Use 390×844 for mobile-shaped behavior; set `deviceScaleFactor: 1` so screencast and screenshot sizes stay comparable.
- Use the exact same viewport for baseline and candidate evidence, and restore the original viewport afterwards.

## Baseline and candidate lanes

For bug fixes and visual regressions, prefer two lanes with the same fixture, config, viewport, captions, actions, and assertions.

The lane switch is a **rebuild**, not a page reload: check out the base commit in a separate worktree, `pnpm build` there, and install that `.output/chrome-mv3` into a separate profile. Record the branch and SHA for both. Never simulate the old behavior on the candidate build; if a faithful baseline is unavailable, state the limitation.

## Deterministic data and privacy

- Fresh Chrome profile per take. Never attach to the operator's daily browser: bookmarks, open tabs, history, and real provider API keys end up in frame.
- Force the whole `config` object from the service worker; do not rely on ambient settings.
- Prefer `microsoft-translate-default` — no key on screen and no key in logs.
- If a scene genuinely needs a keyed provider, use a throwaway key, keep the options page's key field off camera, and confirm frame-by-frame before uploading.
- Use a local fixture or a stable public page with non-personal content.
- Inspect representative frames before any public upload. Uploads are permanent.

## Trimming and cropping

- When trimming, extract full-resolution frames near the intended cut and choose the timestamp from those frames.
- When cropping, measure `x`, `y`, `width`, `height` from a full-resolution captured frame. Never guess from a scaled screenshot.
- Preserve enough surrounding page chrome to orient the reviewer — for an in-page translation demo, the surrounding untranslated layout is what makes the change legible.

## Cleanup

Finish all visual inspection before closing. Restore the viewport, close the browser in a `finally`, and stop the fixture HTTP server. Do not continue browser automation after closing in the same run.
