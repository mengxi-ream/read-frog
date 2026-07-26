---
"@read-frog/extension": patch
---

feat(save-suggestion): generate save suggestions with the user's own selection-translate AI provider (LLM providers only), add an in-card switch to turn suggestions off, and replace the hosted-quota backoff with a persisted per-provider failure cooldown that doubles from 2 minutes and resets on success or provider config changes
