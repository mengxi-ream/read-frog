---
"@read-frog/extension": minor
---

feat(translate): add vocabulary translation mode with inline word glosses

Adds a "vocabulary" translation mode that keeps the original text and
annotates words beyond the user's familiar frequency rank with an inline
gloss, e.g. "discover(发现)". Rare-word detection runs locally; the configured
provider only generates glosses for detected words, cached in IndexedDB.
Right-click an annotated word to mark it known.
