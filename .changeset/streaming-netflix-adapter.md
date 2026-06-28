---
"@read-frog/extension": patch
---

Add a streaming subtitle adapter framework with Netflix as the first adapter. On Netflix it pairs the platform's own official source-language captions with its official target-language subtitles into bilingual cues — an official-to-official comparison rather than machine translation. Other streaming sites plug into the same shared capture + alignment pipeline through one adapter registry.
