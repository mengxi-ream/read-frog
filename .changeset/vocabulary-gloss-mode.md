---
"@read-frog/extension": minor
---

feat(translate): add vocabulary translation mode with inline word glosses

Adds a third translation mode "vocabulary" that keeps the original text and
annotates words beyond the user's familiar frequency rank with an inline
parenthesized gloss, e.g. "discover(发现)". Rare-word detection runs locally
against a bundled frequency list plus a user-maintained known-word list
(right-click an annotated word to mark it as known); the configured LLM
provider only generates glosses for the detected words, with results cached
in IndexedDB.
