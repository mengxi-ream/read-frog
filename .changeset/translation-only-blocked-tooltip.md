---
"@read-frog/extension": patch
---

fix(translation): explain the disabled translation-only mode in a tooltip

The reason "Translation only" is greyed out never reached the screen: a disabled
select row is `pointer-events-none`, so the browser never rendered its native
`title`. Show it in a real tooltip instead, and build the sentence from whichever
provider blocks the mode, so the popup toggle, the mode shortcut and the options
select all stay correct as that list changes.
