---
"@read-frog/extension": patch
---

feat(subtitles): request AI subtitles on Bilibili videos. The extension waits for the player to reach the part the page names and sends that part's cid, so each part, including on an av link, gets its own transcript. An AI track that fails to reload during playback, such as when the subscription has ended, now returns to the site's subtitles instead of asking the server again every second. On every site, a failed AI request now turns Read Frog's subtitles off, brings back the site's own, and says why in a toast over the AI subtitles button
