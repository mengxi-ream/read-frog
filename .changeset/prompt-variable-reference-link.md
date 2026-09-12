---
"@read-frog/extension": patch
---

Point the documentation links at their new locations, and add a link from both prompt editors to the prompt variable reference.

The variable chips under a prompt field carry one line of explanation each, which is not enough to write a prompt with worked examples in it: `{{targetLanguage}}` arrives as an English display name rather than a code, `{{input}}` looks different once batch translation is on, and a variable with no value becomes a literal English sentence. The new link goes to the page that shows a real sample value for each one.
