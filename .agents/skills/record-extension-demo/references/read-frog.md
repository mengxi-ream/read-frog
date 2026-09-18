# Recording in this repository

Repo-specific facts for the generic workflow in `SKILL.md`. Do not re-derive them.

## Tooling on this machine

- `python3` is 3.12 with Pillow installed, and `ffmpeg`/`ffprobe` are on `PATH` (Homebrew). `scripts/build_demo.py` and `scripts/qa_demo.py` run directly — no venv, no `ffmpeg-static`.
- Puppeteer is **not** a dependency of this repo. `npm i puppeteer` inside the session scratchpad; Chrome binaries are already cached in `~/.cache/puppeteer`, so this is fast and installs nothing into the repository.
- Upload with `gh image <file> --repo mengxi-ream/read-frog` (gh-image v1.3.0 is installed; normal `gh` token, no session cookie). It prints one bare `user-attachments` URL. The upload step is carried over from the skill this was ported from and has not been exercised in this repository yet — check its output before pasting it into a PR body.
- Measured cost of a small take: `pnpm build` ≈ 5 s (warm), record two scenes ≈ 40 s, assemble MP4 + GIF ≈ 10 s.

## Build the artifact under test

```bash
pnpm build && test -f .output/chrome-mv3/manifest.json
```

- Never pipe the build through `tail`/`head` to shorten it — the pipe's exit code masks a failed build.
- In a worktree, `.env.production` must exist or the build dies with a buried error. Copy it from the main checkout.
- `.output/` is gitignored; the demo binaries stay in the scratchpad either way. Never commit a video.

## Install and control the extension

Start from [recorder-template.js](recorder-template.js) — a working two-scene recorder proven end to end on 2026-09-17 (install → config → translate → assert → restore → 1280×800 frames → MP4 + GIF). Copy it into the scratchpad and adapt the fixture, captions, and scene actions. What it encodes:

- `puppeteer.launch({ headless: false, pipe: true, enableExtensions: true })` then `browser.installExtension(absolutePathTo('.output/chrome-mv3'))`. Branded Chrome 137+ ignores `--load-extension`.
- **Installing opens a guide tab.** `onInstalled` with reason `install` opens `${WXT_WEBSITE_URL}/guide/step-1` (`src/entrypoints/background/index.ts`). It appears while you are setting up and will be the foreground tab if you do not handle it: wait for it, close it, then create the fixture page. Never let it into a frame.
- A fresh config also triggers `selectFreshTranslateProviders()`, which probes Google Translate and can hang for seconds on a blocked network. Let the service worker settle before you patch config, and warm the flow before the take.
- Patch the **whole** `config` object in `chrome.storage.local` from the service-worker target, with mutations inlined in the evaluated function; patch, wait ~4 s, patch again, and echo the values back. Background init/migration clobbers early writes, a partial config fails `configSchema.safeParse` and silently falls back to `DEFAULT_CONFIG`, and the MV3 service-worker CSP blocks `new Function`/eval.
- The page-translation keys live under **`config.pageTranslation`** (`.mode`, `.providerId`, `.requestQueueConfig`) — there is no top-level `config.translate`. The schema is non-strict, so writing a stale key is stripped without an error and the patch looks like it worked. Always return the value you just set.
- **Always force `config.language.targetCode = 'cmn'`.** Onboarding overwrites it with the browser UI language, and the same-language skip then translates nothing on an English fixture — a video of the extension doing nothing, with passing "no errors" logs.
- Toggle translation with the webext-core envelope from the service worker: `chrome.tabs.sendMessage(tabId, { id, type: 'askManagerToTogglePageTranslation', data: { enabled }, timestamp })`. Do not synthesize Alt+E: on macOS Option+E is a dead key and the hotkey never fires.
- Provider: `microsoft-translate-default` needs no API key but does need real network. It is the default choice for demos — nothing secret can end up on camera, and it is already `DEFAULT_CONFIG.pageTranslation.providerId`. Slow the queues (`pageTranslation.requestQueueConfig.rate/capacity = 1`) only when the point of the scene is a spinner.
- Set `config.floatingButton.enabled = false` unless the floating button is the subject; otherwise it rides along in every frame.
- Fixtures must be served over `http://localhost` — content scripts do not run on `file://`.

## Extension pages

The built manifest exposes `popup.html`, `options.html`, and `sidepanel.html`. Record them as ordinary tabs at `chrome-extension://<extension id>/<page>` — take the id from the installed extension's service-worker target URL. The popup is far smaller than 1280×800: size the viewport near the real popup and let `build_demo.py` pad it onto the output canvas rather than stretching it.

The options page renders provider API keys. Use a fresh profile so those fields are empty, and check the frames anyway.

## Reading extension DOM state in a scene

The counts a scene asserts, from a real take on a 4-paragraph fixture in bilingual mode: 8 wrappers, 0 anchors, CJK present; after restore, 0 and 0.

- Bilingual mode: original text stays, `.read-frog-translated-content-wrapper` is inserted next to it.
- translationOnly, in-place swap (the usual path): no wrapper remains; the run's parent carries `data-read-frog-translation-only` and the site's own text nodes hold the translation.
- translationOnly, fallback: the wrapper holds the translation, originals detached but retained for restore.
- After "show original": zero wrappers **and** zero `[data-read-frog-translation-only]`. The walker's `data-read-frog-walked/-paragraph/-block-node/-inline-node` labels persist by design — that is not a leak, and an innerHTML comparison must strip them.

## Overlays

Caption pills and click rings are injected into the page the extension is translating. Give every injected node `class="notranslate" translate="no"` — verified to keep the pill in its original language while the article around it is translated. Without it the extension walks the pill: the caption gets translated on camera and its nodes inflate the wrapper/anchor counts the scene asserts. Give them `pointer-events: none` too — this repo has already shipped one full-screen overlay that swallowed page clicks.

## Before the take

- Warm the fixture and the translation path once (translate, restore, close), then start the screencast. The first run pays for provider connection and content-script init.
- A screencast only emits on repaint, and this matters more here than it sounds: a measured two-scene take produced **9 and 3 frames**, not hundreds. A 1px scroll nudge buys roughly one frame, so budget nudges through the presentation hold and let `hold_last_seconds` carry the rest. For a scene with no motion at all, write an explicit `page.screenshot({ type: 'jpeg' })` frame. ~6 KB frames are blank, ~126 KB is a painted 1280×800 frame.
- Gate on a selector or a translated-node count, never on a fixed sleep and never on `networkidle` for a page with long-polling or media.
- Production builds make `logger` a no-op, so an empty console proves nothing about the extension's own code path. Assert the DOM.

## Before uploading

- Extract one still per scene with `ffmpeg` and look at it. Passing assertions have shipped blank frames, a subject below the fold, and a caption pill covering the very thing the scene proves — the pill sits top-left, so watch page headers.
- `qa_demo.py` does not clear its output folder; delete `<name>-mp4-qa` first or you will verify the previous take.
- Uploads are permanent and this repository is public: no API keys, tokens, personal tabs, bookmarks, or unrelated notifications in frame.

## PR body

`create-pr` owns the PR wiring: it decides when a demo is required, uploads with `gh image`, and writes the URL into the template's `## Screenshots` section between `<!-- read-frog-pr-demo:start -->` and `<!-- read-frog-pr-demo:end -->` so a rerun replaces the section instead of appending a second video.
