---
"@read-frog/extension": patch
---

feat(glossary): edit a term without deleting and re-adding it

Every part of a term can now be changed in place. The pencil on a row turns it into
fields: the term itself, its translation, the target language it is written for, and
whether it matches case — the `Aa` button on the term field. Enter or the tick saves,
Escape or the cross throws the edit away. Fixing a typo no longer means deleting the row
and typing the whole thing again, which also lost the term's on/off state.

Editing a term keeps it exactly where it was in the list. The list is ordered by when
each term was last changed, so without this the row you had just finished editing would
jump to the end — off the page entirely on a list longer than one.
