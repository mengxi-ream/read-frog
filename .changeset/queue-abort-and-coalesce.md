---
"@read-frog/extension": patch
---

fix(translate): cancel timed-out queue attempts with an AbortSignal before retrying and coalesce concurrent identical batch requests by cache hash, so provider slowdowns no longer stack duplicate in-flight requests
