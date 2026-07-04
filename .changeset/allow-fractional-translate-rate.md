---
"@read-frog/extension": patch
---

Allow fractional translation rates below 1 request per second (minimum lowered from 1 to 0.01), so low-rate-limit APIs like the Gemini free tier (e.g. 0.25 req/s = 15 RPM) no longer hit 429 errors. The rate/capacity inputs now accept decimal input and validate on blur instead of rejecting each keystroke.
