---
"@read-frog/extension": patch
---

fix(site-rules): stop LinkedIn from clipping and merging translations

Replaces the dead `linkedinFeed` rule with a working `linkedin` one. Post and comment bodies no longer get cut off (their collapse container is `max-height:100px`, which only an `!important` override beats), actor headlines wrap instead of ellipsizing, and the post actor block stops collapsing into one oversized paragraph — its wrapper anchor is `display:inline` where the comment equivalent is `block`, so it is forced to a block node. Page chrome (nav, footer, sidebar, ads), author names and the "Visit my website" link are excluded from translation.
