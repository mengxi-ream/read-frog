---
"@read-frog/extension": patch
---

fix(providers): fill in the missing description for providers seeded by a config migration

A provider's description is resolved from the interface language when the provider is created, which a migration cannot do — so Jalapeno Cloud reached existing users in v098 with an empty description box while fresh installs saw its blurb. v099 fills in the English description for any API provider that has none.
