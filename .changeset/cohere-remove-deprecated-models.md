---
"@read-frog/extension": patch
---

fix(model): drop the Cohere Command models retired on 2025-09-15 and move saved configs onto live ones

`command`, `command-nightly`, `command-light`, `command-light-nightly`, `command-r`, `command-r-03-2024`, `command-r-plus` and `command-r-plus-04-2024` are gone from the model picker, and `command-r-plus-08-2024` joins the `command-a-*` line. A v090 → v091 migration moves any saved Cohere provider off a retired id: the `command-r*` families keep their generation and the original `command`/`command-light` line lands on `command-a-03-2025`. That includes a retired id sitting in the custom-model field, which passes validation and would otherwise keep calling a dead endpoint with no visible error. New Cohere providers now default to `command-a-translate-08-2025`.
