---
"@read-frog/extension": patch
---

fix(host): stop retranslation storms on dynamic pages by ignoring self-caused mutations, fixing false staleness, capping per-source retranslation, deduplicating mutation observers, and cleaning up detached translation UI (#1831)
