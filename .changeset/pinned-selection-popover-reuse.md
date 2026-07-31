---
"@read-frog/extension": patch
---

feat(selection): reuse a pinned selection popover in place — translating or running a custom action on a new selection keeps the pinned window's position, size, and pin state and streams the new result into it instead of reopening at a new anchor
