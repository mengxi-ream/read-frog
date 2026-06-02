---
"@read-frog/extension": patch
---

feat(translation-hub): remember selected translation services

The Translation Hub now persists your translation-service selection across reloads and sessions instead of resetting to all enabled providers each time. Selections referencing providers that were later removed or disabled are dropped automatically.
