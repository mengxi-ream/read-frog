---
name: extension-puppeteer-debugging
description: Use when you need to drive the BUILT read-frog extension in real Chrome with Puppeteer — verifying a translation fix end-to-end, reproducing a DOM bug on a fixture page, or asserting restore/toggle behavior programmatically. Covers Chrome 137+ extension loading, config patching, and message-based toggling. For Playwright/Edge screenshots use extension-real-browser-testing; for leaks/freezes use extension-perf-forensics.
metadata:
  author: read-frog
  version: "1.0.0"
---

# Extension Puppeteer Debugging

Drive the built extension in headed Chrome from a Node script: install it, force a known config, toggle translation via the extension's own message bus, and assert on live DOM. Every step below exists because the obvious alternative **failed in practice** (2026-07-13, issue #1846 verification).

## Quick reference

| Step | Do this | NOT this (fails silently) |
|---|---|---|
| Build | `pnpm build` then `test -f .output/chrome-mv3/manifest.json` | Trusting `pnpm build \| tail` exit code (tail's exit code masks failure); missing `.env.production` in a worktree kills the build with a buried error — copy it from the main checkout |
| Load | `puppeteer.launch({ pipe: true, enableExtensions: true })` + `browser.installExtension(path)` (Puppeteer ≥22.11) | `--load-extension` / `--disable-extensions-except` — ignored by branded Chrome 137+ |
| Config | Read-merge-write the WHOLE `config` object in `chrome.storage.local` from the service-worker target; **re-patch after ~4s and verify** (background init/migration clobbers early writes) | Patching once and navigating immediately; writing a partial config object — it fails `configSchema.safeParse` and `getLocalConfig()` silently falls back to `DEFAULT_CONFIG` (bilingual mode) |
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

## Interpreting extension DOM state

- Bilingual mode: original text stays; wrapper `.read-frog-translated-content-wrapper` inserted next to it.
- translationOnly, in-place swap (preferred since #1846): **no wrapper remains**; the run's parent carries `data-read-frog-translation-only` and the site's own text nodes hold Chinese.
- translationOnly, fallback: wrapper holds the translation, originals detached but retained for restore.
- After "show original": zero wrappers AND zero `[data-read-frog-translation-only]` anchors; walk labels remain — that's normal, not a leak.

## Related skills

- **extension-real-browser-testing** — Playwright + Edge variant, popup/options-page evaluation, screenshot evidence rules.
- **extension-perf-forensics** — when the symptom is leak/freeze/CPU, not wrong DOM: attribution ladder, CDP metrics, tracing.
