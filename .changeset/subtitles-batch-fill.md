---
"@read-frog/extension": patch
---

fix(subtitles): fill each AI translation request up to the batch limits while a video plays, instead of sending one subtitle line per request once the first 30 seconds were translated
