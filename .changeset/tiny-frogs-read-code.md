---
"@read-frog/extension": patch
---

fix(page-translation): keep arXiv and ar5iv inline code identifiers untranslated in bilingual and translation-only modes while continuing to skip standalone code listings.

Apply the same prose-only paragraph filters in both modes, avoiding unnecessary translation requests for code-only content.
