---
"@read-frog/extension": patch
---

feat(hosted-ai): pick which Built-in AI model each feature uses and how much it reasons. Provider menus list the models the server offers with their maker's logo, the popup's provider avatars show that logo too, and the API Providers page has a card per model with its reasoning level. A model that can't run shows a warning icon whose tooltip says why and what to switch to, and fails with that advice instead of switching by itself. Features already on Built-in AI move to GPT-6 Luna
