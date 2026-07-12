---
"@read-frog/extension": patch
---

fix(host): stop retranslation storms on dynamic pages by ignoring self-caused mutations, fixing false staleness, capping per-source retranslation, deduplicating mutation observers, and cleaning up detached translation UI; exclude the hltv.org navigation whose overflow handler loops on width changes (#1831)
