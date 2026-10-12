---
"@read-frog/extension": patch
---

feat(selection-toolbar): keep the selected sentence in Sentence Analysis and Improve Writing answers

Both built-in AI actions now start with a field that holds the text you selected. The AI never writes it: it travels with the answer, so a notebase these actions create saves the sentence in a column of its own, and the website can turn those notes into review cards.
