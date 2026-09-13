---
"@read-frog/extension": minor
---

feat(provider): lock OpenRouter requests to specific providers

OpenRouter spreads each request across every provider serving a model, so the same prompt
can be answered by a different provider from one call to the next. The OpenRouter provider
now has a **Lock providers** field: list the provider slugs you want, comma-separated
(`deepinfra, together`), optionally down to a single endpoint variant or region
(`deepinfra/turbo`, `google-vertex/us-east5`). Requests then go only to those providers,
with fallbacks disabled, so a failure surfaces as an error instead of silently drifting to
a provider you did not choose. Leave the field empty to keep OpenRouter's default
price-based load balancing.
