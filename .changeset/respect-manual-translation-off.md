---
"@read-frog/extension": patch
---

fix(translate): stop auto-translation from re-enabling a page the user manually turned off (#2011) — a manual "show original" (popup, floating button, shortcut, touch gesture, context menu) now records a per-tab, per-origin refusal that the tab-activation language re-detection respects until the tab leaves that origin
