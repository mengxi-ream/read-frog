---
"@read-frog/extension": patch
---

fix(translate): recognize LLM near-echoes of the source (whitespace reflow, NBSP, smart quotes, ellipsis, fullwidth punctuation, case drift) as untranslated and hide them instead of duplicating the paragraph
