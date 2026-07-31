---
"@read-frog/extension": minor
---

feat(model): sync Cohere provider model list and remove deprecated Command models

- Adds `command-a-plus-05-2026`, `command-a-translate-08-2025`, and `command-r-plus-08-2024`
- Removes deprecated Cohere models: `command`, `command-nightly`, `command-light`, `command-light-nightly`, `command-r`, `command-r-03-2024`, `command-r-plus`, `command-r-plus-04-2024`
- Adds config migration v088 -> v089 to remap saved provider configs using deprecated Cohere models to the closest live model
