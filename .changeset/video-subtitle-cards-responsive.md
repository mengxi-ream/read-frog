---
"@read-frog/extension": patch
---

fix(ui): improve video subtitle settings cards responsive layout

- Add flex-wrap for form fields to support responsive wrapping
- Reduce control width from w-48 to w-40 for better fit
- Add md:grid-cols-2 breakpoint for two-column card layout
- Use gap-1 for label-value spacing when wrapped
