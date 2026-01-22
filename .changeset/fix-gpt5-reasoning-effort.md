---
"@read-frog/extension": patch
---

fix(ai): configure reasoning effort per GPT-5 model variant

- GPT-5.2 and GPT-5.1+ don't support 'minimal', now use 'none'
- gpt-5-pro uses 'high', gpt-5.2-pro uses 'medium'
- gpt-5.x-chat-latest models use 'medium'
- GPT-5 (before 5.1) and o1/o3 models keep 'minimal'
