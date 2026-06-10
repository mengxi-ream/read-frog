---
"@read-frog/extension": patch
---

feat(subtitles): export translated subtitles

Add a "Download translated subtitles" action that exports a complete AI-translated SRT from the full source subtitle track. Fail closed on missing translations, rejects same-language export, and falls back to source timing when AI segmentation produces coverage gaps.
