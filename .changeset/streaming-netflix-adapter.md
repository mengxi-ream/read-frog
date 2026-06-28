---
"@read-frog/extension": patch
---

Add a streaming subtitle adapter framework with Netflix as the first adapter. Netflix uses official subtitle download tracks when the page exposes them, and falls back to the player-rendered subtitle DOM on current playback paths where static subtitle assets are not directly available. Other streaming sites plug into the same shared capture pipeline through one adapter registry.
