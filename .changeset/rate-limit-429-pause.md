---
"@read-frog/extension": minor
---

fix(translate): stop a single 429 from failing the whole page and make rate limiting actually hold

- A 429 now pauses the queue (honoring `Retry-After`) and retries in place instead of instantly rejecting every pending paragraph — one transient rate limit no longer paints hundreds of errors or kills the session
- Batches now keep filling up to the configured size while the rate limiter has no free slot, so low request rates send few full batches instead of many tiny ones
- Queue config is applied reliably: handlers register synchronously at SW startup, `storage.watch` replaces droppable per-field messages, and capacity edits no longer grant a free burst
- Batch request timeouts scale with batch size; summary generation is abortable and no longer performs hidden ai-sdk retries
