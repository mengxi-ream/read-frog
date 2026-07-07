---
"@read-frog/extension": minor
---

feat: add a per-site translation rule engine. 463 built-in rules plus user-defined JSON rules control what gets translated per site: exclude/include selectors, force block/inline rendering, minimum character/word thresholds, and per-site injected CSS. URL matching now supports subdomain, TLD, and path wildcards. A new "Site Rules" options page provides a zod-validated JSON editor for custom rules and a searchable, per-rule-disableable viewer for built-in rules. The previous hardcoded site adaptations are migrated into built-in rules.
