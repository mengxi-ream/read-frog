---
"@read-frog/extension": patch
---

fix(note-suggestions): make structured output compatible with OpenAI

Note suggestions now use a required nullable summary field, preventing OpenAI's strict JSON Schema validation from rejecting the request before generation starts.
