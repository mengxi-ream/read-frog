---
"@read-frog/extension": patch
---

fix(custom-actions): keep custom layout CSS as written when nothing in it is unsafe, so a `var()` shorthand followed by one of its longhands, such as `text-decoration: underline wavy var(--c); text-decoration-thickness: 2px`, no longer gets dropped
