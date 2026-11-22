---
"@read-frog/extension": patch
---

fix(providers): let guests pick the Built-in AI models signing in unlocks

Logged-out users can now choose Built-in AI models in the provider menus, the popup and the options page instead of seeing them grayed out. Only models that need a plan the account would still lack after signing in, such as the Ultra models, stay locked, the same as for a free account. The menus' "LLM Models" group is now called "Third-party Models".
