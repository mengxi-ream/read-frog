---
"@read-frog/extension": patch
---

Optimize YouTube subtitle fetching by trying a fast timedtext fetch from the initial player data snapshot before falling back to the slower POT/wait flow.
