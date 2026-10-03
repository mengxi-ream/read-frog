---
"@read-frog/extension": patch
---

feat(selection): enable tools in same-origin iframes on the first selection without eagerly loading the full runtime

Remove redundant eager injection rules for same-origin readers, including Kiwix; explicit injection rules remain available for cross-origin and special-frame compatibility.
