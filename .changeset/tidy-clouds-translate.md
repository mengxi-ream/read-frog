---
"@read-frog/extension": patch
---

fix(translate): move Microsoft translation to the unauthenticated edge translatetext endpoint

The old token endpoint (edge.microsoft.com/translate/auth) was removed upstream, which broke Microsoft translation entirely. The replacement endpoint needs no auth but has no markup-preserving mode, so translation-only page mode no longer offers Microsoft: pickers hide it while translation-only is active, mode controls explain why it cannot be entered, and existing configs pairing them are migrated to Google Translate (or bilingual mode as a fallback). Microsoft translation error handling now also carries retry metadata, and the restored free-api tests cover the live endpoint again.
