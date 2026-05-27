---
"@read-frog/extension": minor
---

feat(translate): add sentence-interleave translation via `interleave` config

Adds `interleave` config field (`"paragraph"` | `"sentence"`) under translate config. When `interleave` is `"sentence"`, bilingual translation interleaves each source sentence with its translation using `Intl.Segmenter` for sentence segmentation and batch translation via `%%` separators.

The popup mode selector no longer shows sentence-interleave as a separate mode — it is configured in the options page.
