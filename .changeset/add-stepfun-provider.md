---
"@read-frog/extension": minor
---

feat(providers): add Stepfun (阶跃星辰) provider support

Adds Stepfun as a built-in OpenAI-compatible LLM provider with default baseURL
`https://api.stepfun.com/v1` and the following models: `step-2-mini` (default,
recommended for fast and low-cost translation), `step-3.5-flash`,
`step-3.5-flash-2603`, `step-2-16k`, `step-1-32k`, `step-1-8k`.
