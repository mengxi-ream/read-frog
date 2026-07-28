---
"@read-frog/extension": patch
---

fix(translate): stop page-translation flicker on same-origin navigation

Same-origin route changes no longer tear down and rebuild every translation
wrapper. The live MutationObserver keeps translating newly inserted content,
and Navigation API listening waits for `currententrychange` (URL committed)
instead of the pre-commit `navigate` event that flashed original text on the
still-visible previous page.
