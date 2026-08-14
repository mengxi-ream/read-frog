---
"@read-frog/extension": patch
---

fix(translation): translate YouTube watch titles through hover translation

Allow YouTube's visible watch-title element directly so experimental layouts without the usual `h1` wrapper still produce a translatable hover paragraph, and apply matched site-rule layout CSS during hover translation so YouTube's two-line title clamp cannot clip the inserted translation.
