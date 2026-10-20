---
"@read-frog/extension": patch
---

perf(content): load pages faster by injecting a small loader instead of 8 MB of content scripts; it loads one shared runtime that runs page translation, the selection toolbar and the floating button
