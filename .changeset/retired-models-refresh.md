---
"@read-frog/extension": patch
---

feat(providers): add GPT-6.2, Fable 5.2 and Gemini 4 models and drop retired ones

Add GPT-6.2 Sol and Astra, Claude Fable 5.2, Gemini 4 Carbon, Hydrogen and Neon, Nova 2 Lite and Fable 5.2 on Bedrock, and GLM 5.3 on Mistral. Drop the models OpenAI, Anthropic, Google, Moonshot, Groq, Cerebras and Mistral have shut down, and move providers that used them to the recommended replacement. Moonshot now defaults to Kimi K3, because Kimi K2.6 is closed to new Kimi accounts.
