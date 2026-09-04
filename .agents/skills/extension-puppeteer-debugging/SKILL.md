---
name: extension-puppeteer-debugging
description: Debug the built Read Frog extension in real Chrome. Use Chrome DevTools MCP for interactive inspection and screenshots; use the Puppeteer harness for repeatable end-to-end assertions, fixture pages, and translation toggle/restore flows. For leaks, freezes, or CPU storms use extension-perf-forensics.
metadata:
  author: read-frog
  version: "1.1.0"
---

# Extension Browser Debugging

Debug the built extension in real Chrome. Choose the lightest workflow that produces trustworthy evidence:

- Use Chrome DevTools MCP for interactive UI checks, extension installation/reload, extension pages and service workers, DOM/computed styles, console/network inspection, and screenshots.
- Use the Puppeteer harness when the result must be repeatable, needs a controlled fixture or fresh profile, or requires programmatic toggle/restore assertions.

Always build the artifact under test and confirm `.output/chrome-mv3/manifest.json` exists before loading it. Do not treat dev-server behavior as proof of the production build.

## Chrome DevTools MCP prerequisites

The extension tools are disabled by default. The MCP server must start with:

```text
--categoryExtensions=true
```

Restart the MCP client after changing its server configuration. Before building, confirm that `install_extension`, `reload_extension`, `list_extensions`, and `trigger_extension_action` are available. If they are missing, fix the MCP configuration rather than falling back silently to webpage-only tools.

`install_extension` accepts an absolute path to an unpacked extension directory. The server restricts filesystem access to MCP workspace roots and the OS temp directory. If it rejects a valid build path:

1. Prefer configuring or repairing the client's workspace roots.
2. Use `--allow-unrestricted-paths` only for a trusted local client and only after the user explicitly authorizes the wider filesystem access.
3. Never copy a build through a symlink to evade the path check.

Chrome DevTools MCP launches its own Chrome profile. Concurrent MCP clients can contend for the default profile; use distinct `--userDataDir` values or `--isolated=true` when Codex, Claude, or multiple tasks may run the server at the same time. A fresh or isolated profile also avoids stale extension state, but state-dependent bugs may require a deliberate persistent test profile.

## Chrome DevTools MCP workflow

1. Build the extension, verify its manifest, then install the absolute `.output/chrome-mv3` path with `install_extension`.
2. Record the returned extension ID. Confirm the extension page and MV3 service worker appear in `list_pages`.
3. Open the actual popup/options page or a target content page.
4. Reproduce the interaction through the real UI or extension message path.
5. Inspect live DOM/runtime state and computed styles. For tooltips and popovers, node existence alone is insufficient: check open/closed attributes, opacity, visibility, and pointer events.
6. Capture a raw screenshot only after the runtime evidence proves the intended state.
7. Close temporary pages/profiles and local fixture servers created for the check.

For screenshots, keep raw before/after captures as the source of truth. Label crops and stitched comparisons as supplemental artifacts. Never present a composite as a raw browser screenshot.

Use a fresh profile or the Puppeteer harness when persistent browser state could affect the result. Record the browser/version, build path, target URL, interaction, runtime evidence, and screenshot path for consequential regressions.

## Puppeteer workflow

Drive headed Chrome from a Node script to install the extension, force known config, toggle translation via its message bus, and assert live DOM. The details below encode failures observed during issue #1846 and #2011 verification.

## Quick reference

| Step | Do this | NOT this (fails silently) |
|---|---|---|
| Build | `pnpm build` then `test -f .output/chrome-mv3/manifest.json` | Trusting `pnpm build \| tail` exit code (tail's exit code masks failure); missing `.env.production` in a worktree kills the build with a buried error — copy it from the main checkout |
| Load | `puppeteer.launch({ pipe: true, enableExtensions: true })` + `browser.installExtension(path)` (Puppeteer ≥22.11) | `--load-extension` / `--disable-extensions-except` — ignored by branded Chrome 137+ |
| Config | Read-merge-write the WHOLE `config` object in `chrome.storage.local` from the service-worker target, with mutations **inlined in the evaluated function** (pass only plain data as evaluate args); **re-patch after ~4s and verify** (background init/migration clobbers early writes) | Building the mutation from a code string via `new Function`/eval inside the SW — its CSP (`script-src 'self' 'wasm-unsafe-eval' ...`) blocks eval and throws EvalError; patching once and navigating immediately; writing a partial config object — it fails `configSchema.safeParse` and `getLocalConfig()` silently falls back to `DEFAULT_CONFIG` (bilingual mode) |
| Target language | **Always force `config.language.targetCode = 'cmn'`** | Trusting the default — onboarding overwrites targetCode with the browser UI language, and the same-language skip then translates NOTHING on English fixtures |
| Toggle | Send the webext-core envelope to the content script from the SW: `chrome.tabs.sendMessage(tabId, { id, type: 'askManagerToTogglePageTranslation', data: { enabled }, timestamp })` | Synthesizing Alt+E — on macOS Option+E is a dead key (`event.key !== 'e'`), the hotkey listener never fires |
| Assert translated | CJK regex `/[一-鿿]/` on textContent; count `.read-frog-translated-content-wrapper` (fallback-B) and `[data-read-frog-translation-only]` (in-place swap) | Waiting a fixed sleep |
| Assert restored | Compare innerHTML **modulo walk labels** (`data-read-frog-walked/-paragraph/-block-node/-inline-node` persist by design in every mode) | Byte-identical innerHTML comparison |

## Workflow

1. Build and verify the artifact exists (see table).
2. Copy `references/harness-template.js` into the session scratchpad, point `EXT_PATH` at `.output/chrome-mv3`, adjust the fixture/assertions.
3. Serve fixtures over `http://localhost` (content scripts don't run on `file://`). For framework-safety checks, use a React fixture with a focus-triggered re-render (simulates React Query `refetchOnWindowFocus` — the trigger behind logged-in-only bugs like #1846) and a counter button to prove listeners survived.
4. Run headed; capture `page.on('console')` + `pageerror` for `Minified React error|NotFoundError` — a clean screenshot can hide a broken fiber tree.
5. Provider: `microsoft-translate-default` needs no API key but real network. Slow the queues (`requestQueueConfig.rate/capacity = 1`) when you need to observe spinners.

For loading screenshots, first record `.read-frog-spinner` count and relevant computed/inline styles, capture the raw frame, then continue waiting for translated Chinese text to prove that the run completed. A visible screenshot without matching DOM/runtime evidence is insufficient.

## Interpreting extension DOM state

- Bilingual mode: original text stays; wrapper `.read-frog-translated-content-wrapper` inserted next to it.
- translationOnly, in-place swap (preferred since #1846): **no wrapper remains**; the run's parent carries `data-read-frog-translation-only` and the site's own text nodes hold Chinese.
- translationOnly, fallback: wrapper holds the translation, originals detached but retained for restore.
- After "show original": zero wrappers AND zero `[data-read-frog-translation-only]` anchors; walk labels remain — that's normal, not a leak.

## Related skills

- **extension-perf-forensics** — when the symptom is leak/freeze/CPU, not wrong DOM: attribution ladder, CDP metrics, tracing.
