---
"@read-frog/extension": patch
---

refactor(hosted-ai): rename the advanced Built-in AI tier from ultra to advance

The hosted model tier is now `advance` rather than `ultra`, and the advanced built-in provider's id is `read-frog-advance-ai` rather than `read-frog-ultra-ai`. Model names and plan names are now separate vocabularies: which plan unlocks which tier is server-side policy, so a future plan can be sold with any tier without renaming anything here. The provider's display name is unchanged ("Advanced Built-in AI"), and the "Ultra" badge, its tooltip, and the "Ultra plan required" message all still say Ultra on purpose — they name the plan you have to buy, not the model you run on.

Config schema v097 rewrites the provider id everywhere it is persisted, so an existing selection of the advanced provider is preserved.
