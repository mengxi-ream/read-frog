---
"read-frog": patch
---

fix(subtitles): follow YouTube's own default caption track

When the viewer had YouTube's own CC off, the player reported no selected track and the fetcher fell back to whichever caption track happened to be listed first — so a video whose first track is not the viewer's usual language had to be corrected by hand every time. The player response already names the track YouTube itself would play (`defaultCaptionTrackIndex`), so read that instead. A live selection in the player still wins, and responses that omit the field fall back to enabling CC and following the player's choice.
