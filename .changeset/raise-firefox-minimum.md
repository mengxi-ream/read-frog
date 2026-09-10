---
"@read-frog/extension": patch
---

chore(firefox): raise the minimum supported Firefox to 140

The manifest previously declared Firefox 112 as the floor, a value set when Firefox
first shipped MV3 and never revisited. The extension already calls `Intl.Segmenter`
on the page-translation path (`filter-small-paragraph.ts`), which requires Firefox
125, so the declared floor was not one the code could keep. Firefox 140 is a
currently supported ESR.
