---
"@read-frog/extension": patch
---

fix(glossary): correct term matching, CSV round-tripping, and the term counter

A term is no longer skipped when a longer term starts at the same place and does not
apply there. `Chort` was lost in "landed at Chort bayonet" because `Chort Bay` matched
first and then failed at its edge — while the same term still worked in other sentences,
which made it hard to notice.

Exported CSVs now carry each term's case-sensitivity setting and open correctly in Excel,
so exporting and re-importing a glossary lands back on the rows it came from instead of
adding a second copy of every case-sensitive term. Files saved by Excel in a regional
encoding are read properly rather than imported as garbled text, and a quoted value
spanning two lines no longer turns into a stray "keep the original" rule.

The term count under a glossary now describes that glossary, and the 20,000-term limit —
which counts every glossary together — is shown with the glossary library, where it
applies. Running out of room says so in those terms instead of calling one glossary full.
