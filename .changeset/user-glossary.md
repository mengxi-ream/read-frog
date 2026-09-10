---
"@read-frog/extension": minor
---

feat(glossary): add user-defined glossaries

Define a term once and every AI translation uses your wording. Leave a term's translation empty to keep it
in the original language, which is usually what names and usernames need. Only the terms that actually
appear in a paragraph are sent to the model, so a large glossary costs nothing on pages that do not use it.

Terms live in glossaries, and each glossary can be limited to the websites you want it on — a set of game
terms on one wiki, work vocabulary on your company's docs, nothing anywhere else. A glossary with no
website listed applies everywhere. Where two glossaries give the same term different wording, the one
lower in the list wins.

Turn an individual term or a whole glossary off without deleting it, import and export each list as CSV,
or empty it in one go. Find it under Advanced → Glossary in the extension settings.
