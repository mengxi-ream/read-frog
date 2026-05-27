---
"@read-frog/extension": patch
---

refactor(translate): remove "lineByLine" from TranslationMode enum

Migration v73 maps legacy `mode: "lineByLine"` configs to `mode: "bilingual"` + `interleave: "sentence"`. The line-by-line rendering logic is moved inside `translateNodesBilingualMode`, gated by the `interleave` config field.
