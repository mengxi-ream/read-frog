---
"@read-frog/extension": patch
---

feat(ui): bundle Onest Variable (~62 KB) and use it for the extension's Latin UI text, matching the web app. Imported only in the extension's own pages (popup / options / side panel / translation hub), so no webfont is injected into content scripts on host pages. Also adds an unlayered `body { font-family: var(--rf-font-sans) }` override — Chromium injects `body { font-family: system-ui, … }` into every extension page (extension_fonts.css), which otherwise intercepts the inherited font stack so neither Onest nor the CJK fallbacks would ever apply
