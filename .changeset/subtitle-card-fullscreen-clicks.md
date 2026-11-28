---
"@read-frog/extension": patch
---

fix(subtitles): let the subtitle word card take clicks while the video is fullscreen

On sites that make the player itself fullscreen, such as X and Bilibili, the card that opens from a subtitle word showed over the video, but Chrome sent clicks on it to the player underneath. The card now moves into the fullscreen player, and back out when fullscreen ends.
