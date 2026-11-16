---
"@read-frog/extension": patch
---

fix(subtitles): keep video subtitles off on sites where Read Frog is disabled. "Disable on this site" and the site list now apply to subtitles too, including a video embedded in a disabled page; in whitelist mode, subtitles only run on the listed sites, including in videos those pages embed from other sites. Video sites no longer load the subtitle code at all while subtitles are switched off or the site is disabled
