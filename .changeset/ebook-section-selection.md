---
"@read-frog/extension": minor
---

feat(ebook): translate books in the readfrog.app reader. Page translation now reaches the reader's book sections, which Chrome's webNavigation API hides from the background's iframe injection, through a content script of their own; selections inside a section stay with the reader's bridge instead of a second toolbar clipped to the page.
