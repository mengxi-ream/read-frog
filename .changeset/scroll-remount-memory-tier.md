---
"@read-frog/extension": patch
---

fix(translate): remember page translations in-tab so virtualized remounts stop re-translating

Virtualized pages (X articles and timelines, and any React list that unmounts off-screen rows) destroy paragraph nodes on scroll and recreate brand-new ones on the way back, so scrolling down and back up re-ran the whole translation pipeline for text the tab had already translated — every paragraph flashed its original text and a spinner while a background round trip re-fetched the same cached translation. Page-translation results are now also remembered in an in-tab memory tier keyed by the same request hash as the background cache, so remounted regions recover their translations without the round trip or the visible churn.
