---
"@read-frog/extension": patch
---

fix(translation): apply the removal of custom CSS without needing a reload

Switching translated text back to a preset style, or emptying the custom CSS box, only changed the marker on the node — the stylesheet itself stayed applied until the page was reloaded. Anything the preset did not set kept the old styling, so clearing a `color` rule under the border preset, for instance, left the text its old colour. The stylesheet is now withdrawn along with the marker.
