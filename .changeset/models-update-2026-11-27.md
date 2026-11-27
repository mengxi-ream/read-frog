---
"@read-frog/extension": patch
---

feat(providers): add Qwen3.7 Max and move off the Gemini 2.5 models Google is retiring

Add Qwen3.7 Max on Alibaba. Google stops serving `gemini-2.5-pro` and `gemini-2.5-flash` on 2026-12-01 and DeepSeek has retired `deepseek-v4-flash`, so saved providers that use them move to Gemini 3.8 Flash, Gemini 3.5 Flash-Lite and `deepseek-flash`.
