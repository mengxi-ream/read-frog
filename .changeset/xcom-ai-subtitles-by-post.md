---
"@read-frog/extension": patch
---

feat(subtitles): request AI subtitles on X videos whose player shows no media id, such as uploads with a custom cover and live broadcast replays in a post. The server transcribes the post's only video. A replay's own captions arrive only a few seconds ahead of playback, so it now gets AI subtitles instead of a translation of its first seconds; GIFs and broadcasts still live get none
