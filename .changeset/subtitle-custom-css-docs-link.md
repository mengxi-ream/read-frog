---
"@read-frog/extension": patch
---

docs(subtitles): point the subtitle CSS editor at its own tutorial

The "How to configure?" link in the subtitle custom CSS editor opened the page-translation
stylesheet guide, which documents a different selector contract: `[data-read-frog-custom-translation-style]`
and the translated-content wrapper, none of which exist inside the subtitles shadow root. It now
opens `/docs/subtitle-custom-css`, which covers the three class hooks the subtitle overlay
actually exposes, the preset templates, and the two places the style controls win over custom CSS.
