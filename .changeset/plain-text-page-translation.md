---
"@read-frog/extension": patch
---

fix(translation): translate plain-text pages, one paragraph at a time

Pages served as `text/plain` reach the browser as a single generated `<pre>` holding the whole file, which the walker skipped entirely — nifty.org story pages translated as nothing at all. Such a `<pre>` is now translated, while an authored `<pre>` in an HTML document still keeps its code and logs untouched.

Translation-only mode also gains the per-paragraph granularity bilingual mode has had, so a long page goes out one blank-line paragraph at a time instead of as one oversized request: paragraphs appear as they arrive, and a failed one costs only itself.
