---
"@read-frog/extension": patch
---

Refine selection toolbar styling and fix Firefox stylesheet fallback

- Enlarge toolbar button icons and use theme-aware hover/shadow tokens
- Handle Firefox Xray wrapper issues with constructable stylesheets
- Extract host toast into dedicated mount module
- Unify cn helper location under utils/styles
