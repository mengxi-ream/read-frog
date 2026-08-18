---
"@read-frog/extension": patch
---

fix(selection): collapse idle selection overlay so page touch drag gestures are not stolen

The selection toolbar's always-mounted full-viewport `fixed inset-0` layer
made Chrome claim horizontal touch pans on pages using `touch-action:
manipulation`, firing `pointercancel` and breaking touch drag gestures
(e.g. carousels). Collapse the overlay root to 0x0 while the toolbar is
idle; it expands back to full viewport when the toolbar becomes visible.
