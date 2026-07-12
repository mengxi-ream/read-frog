---
"@read-frog/extension": patch
---

fix(translate): remove orphan splitText tails when the host rewrites or replaces the source Text node, so failed split restores no longer duplicate stale tail text on pre-wrap sites
