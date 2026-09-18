---
name: record-extension-demo
description: Record polished, evidence-backed demos of the Read Frog extension as MP4 (and optional GIF) by driving real Chrome with the built extension, following captioned scene scripts, asserting extension state in the DOM, comparing baseline and candidate behavior when useful, post-processing the capture, and visually validating the result. Use for PR demos of user-visible frontend changes, feature walkthroughs, before/after bug evidence, popup/options/side-panel UI changes, or short interaction recordings.
metadata:
  author: read-frog
  version: "1.0.0"
---

# Record Extension Demo

Treat a demo as verification evidence, not decoration. Every scene needs a reviewer-facing caption, a product-state assertion, and visual proof.

The subject here is the **built extension running in real Chrome** — content-script behavior on a page, or an extension page (`popup.html`, `options.html`, `sidepanel.html`). Dev-server behavior is not proof of the shipped build.

## Operating principles

- Record the production build from `.output/chrome-mv3`, loaded into a fresh Chrome profile with no real API keys.
- Use a local fixture page or a stable public page with deterministic, non-sensitive content.
- Capture browser content (CDP screencast) rather than the whole desktop.
- Record the transition from a recognizable state, not only the final screenshot.
- Reuse the repository's proven extension automation (`extension-puppeteer-debugging`) instead of inventing a parallel setup.
- Keep recordings concise: one to three scenes for a focused change, up to six when materially different states require it.
- Keep API keys, tokens, account data, personal browsing history, and unrelated UI out of frames and logs.
- Store automation scratch files and media in the session scratchpad, never in the repository. Never commit demo binaries.

## 1. Define the evidence plan

Translate the request into an ordered scene matrix:

| Field | Purpose |
| --- | --- |
| Scene | Stable number and short reviewer-facing name |
| Lane | `candidate`, `baseline`, or both |
| Caption | Exact on-screen narration for the scene |
| Setup | Fixture URL, extension config, viewport, and persisted storage |
| Action | Exact click, toggle, navigation, input, reload, or resize |
| Assertion | DOM, URL, storage, or computed-layout fact that proves success |
| End state | What the reviewer should see after the assertion passes |
| Evidence | Video, screenshot pair, or both |

Choose the evidence mode deliberately:

- New interaction or flow: record the candidate behavior.
- Bug fix or visual regression: when practical, run the same scene against the base build and the candidate build with identical fixture, config, viewport, captions, and steps. Include the base and candidate SHAs.
- Static layout/style change (popup, options, injected UI): prefer paired full-resolution screenshots, with a short video only when motion or interaction matters.
- Logic-only refactor with a visible surface: identical baseline/candidate screenshots plus a clean console can be valid regression evidence.

Resolve only blocking ambiguities. Preserve user-provided captions verbatim unless they contain sensitive data or are too long to render clearly.

## 2. Prepare a reproducible extension state

Read [references/read-frog.md](references/read-frog.md) first: build, install, config patching, provider choice, and the traps that cost retakes. Start the recorder from [references/recorder-template.js](references/recorder-template.js) rather than from scratch. Then:

- Build the artifact under test and confirm `.output/chrome-mv3/manifest.json` exists before loading it.
- Launch a fresh profile per take. Force the whole `config` object in `chrome.storage.local` from the service worker so the demo does not depend on the operator's own settings.
- Prefer `microsoft-translate-default` for translation scenes: no API key, deterministic enough, and nothing secret can leak into a frame.
- Serve fixtures over `http://localhost` — content scripts do not run on `file://`.
- Warm the route and the translation path once before recording, unless cold-start behavior is the feature.
- Independently verify anything the video claims numerically (counts of translated nodes, wrapper vs. in-place anchors, storage contents) through a DOM or storage query, and record the query and result as functional evidence.

If the environment cannot reproduce the behavior faithfully — a paid provider, a logged-in site, a store-update-only code path — stop and report the limitation rather than creating misleading evidence.

## 3. Choose the viewport and capture surface

- Default desktop demos to a 1280×800 viewport and output canvas.
- Treat 1280×800 as a default, not a requirement: use a larger canvas for dense pages, or a representative mobile viewport (390×844) when responsive behavior is the point.
- Keep the browser viewport and raw recorder dimensions identical unless deliberate scaling is part of post-production.
- Reuse the exact viewport, fixture, and config for baseline/candidate comparisons.
- The popup is small: record `chrome-extension://<id>/popup.html` in a tab sized close to the real popup instead of stretching it across a desktop canvas, and let the builder pad it.
- To focus on one region, capture a full-resolution frame, measure the crop rectangle from that frame, and record the exact `x`, `y`, `width`, `height`. Never infer crop offsets from a scaled screenshot.

Read [references/browser-capture.md](references/browser-capture.md) completely before implementing capture.

## 4. Record captioned, assertion-gated scenes

For each scene:

1. Restore the declared setup, config, and viewport.
2. Gate readiness with the narrowest reliable signal: a selector, a translated-node count, a `data-read-frog-*` attribute, or storage state. Never use a fixed sleep to decide whether the extension is ready.
3. Start capture after install, onboarding tabs, and unrelated loading prelude are complete.
4. Show the scene caption as a compact pill in the top-left corner — the recorder's pill is the only caption the finished video carries — and add a temporary click-highlight ring around the interaction target. Inject overlays at runtime with `class="notranslate" translate="no"` so the extension never walks or translates them; do not modify extension source for the demo.
5. Perform the action at a human-readable pace.
6. Wait for and assert the expected state. Save the assertion result separately from the pixels.
7. After the assertion succeeds, capture one authoritative final frame at the same pixel dimensions as every screencast frame. CDP screenshots use device pixels while `Page.startScreencast` honors `maxWidth`/`maxHeight`; normalize before assembly.
8. Hold the end state for roughly two to three seconds. Encode this as `hold_last_seconds`; do not confuse it with readiness waiting.
9. Stop capture in a `finally` path and save timestamped frames.

Use this artifact shape in the scratchpad:

```text
demo-work/
  verification.json
  baseline/                 # only when comparison is useful
    01-primary-flow/
  candidate/
    01-primary-flow/
      frame-00000.jpg
      frames.json
      assertion.json
  manifest.json
```

`verification.json` should identify the base branch/SHA, candidate branch/SHA, viewport, fixture, extension version, provider, and scene assertions. No credentials.

## 5. Assemble and post-process

Create a manifest following [references/manifest.md](references/manifest.md), then run:

```bash
python3 .agents/skills/record-extension-demo/scripts/build_demo.py /absolute/path/to/manifest.json
```

The MP4 is the canonical artifact. Set `gif_output` in the manifest when the destination needs a GIF; the builder derives it from the final MP4 with `palettegen`/`paletteuse`.

When the raw recording includes install, onboarding, or unrelated loading prelude:

- extract full-resolution frames around candidate cut points;
- choose trim timestamps from those frames;
- remove the prelude before delivery;
- re-check the new first frame.

Requirements: `ffmpeg` and `ffprobe` on `PATH`, Python ≥ 3.10 with Pillow. Both are already satisfied on this machine (see [references/read-frog.md](references/read-frog.md)). Do not install Python dependencies into the repository.

## 6. Perform functional and visual QA

Run QA on the MP4 and, when produced, the GIF:

```bash
python3 .agents/skills/record-extension-demo/scripts/qa_demo.py /absolute/path/to/demo.mp4 --expected-width 1280 --expected-height 800
python3 .agents/skills/record-extension-demo/scripts/qa_demo.py /absolute/path/to/demo.gif
```

Adjust expected dimensions when the manifest intentionally uses another output size. Inspect the contact sheet and at least one full-resolution frame from each materially different layout.

Confirm:

- the first delivered frame is intentional UI or a title card, not a blank/onboarding/loading frame;
- the caption is readable, appears once, and neither it nor the click ring hides the target;
- each scene's asserted beginning and end states are present;
- baseline/candidate pairs use the same fixture, config, viewport, and steps;
- translated text actually rendered — no spinner (`.read-frog-spinner`) left on screen at the end of a scene;
- no API keys, tokens, account data, unrelated tabs, bookmarks, or notifications are visible;
- MP4 codec/pixel format and GIF size/frame rate suit the destination.

Do not claim a scenario passed unless both its functional assertion and visual QA passed.

## 7. Deliver and clean up

Return:

- absolute MP4 path;
- absolute GIF path when generated;
- scene captions and assertion results;
- baseline/candidate SHAs when compared;
- functional verification summary;
- any mocked data, skipped scene, weaker assertion, or environment limitation;
- paste-ready destination Markdown after upload, or the exact upload step still required.

For GitHub PRs and issues, prefer repository-scoped `github.com/user-attachments` URLs via `gh image` (see [references/read-frog.md](references/read-frog.md)). Never extract or pass a GitHub browser session token. Read Frog is a public repository, but uploads are permanent: inspect frames before uploading.

Close the browser, stop the fixture server, and leave the repository unchanged except for the requested work.

## Bundled resources

- [references/read-frog.md](references/read-frog.md): this repository's build, install, config, provider, upload facts and known traps
- [references/recorder-template.js](references/recorder-template.js): a working two-scene Puppeteer recorder — copy it into the scratchpad and adapt
- [references/browser-capture.md](references/browser-capture.md): screencast capture, overlays, assertion gates, and viewport guidance
- [references/manifest.md](references/manifest.md): MP4/GIF manifest, timing, and optional crop fields
- `scripts/build_demo.py`: deterministic annotated MP4 and optional palette-optimized GIF assembly
- `scripts/qa_demo.py`: media metadata validation and contact-sheet generation

## Related skills

- **extension-puppeteer-debugging** — the underlying harness for installing, configuring, and asserting the extension; read it before writing a recorder.
- **extension-perf-forensics** — when the evidence needed is a leak/freeze/CPU profile rather than a video.
