---
"@read-frog/extension": patch
---

feat(ui): bundle Onest Variable (~62 KB) and use it for the extension's Latin UI text, matching the web app. Imported only in the extension's own pages (popup / options / side panel / translation hub), so no webfont is injected into content scripts on host pages — there "Onest Variable" is just named in the stack and falls back to the system sans
