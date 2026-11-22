---
"@read-frog/extension": patch
---

feat(subtitles): show translations right away at the start of a video and after a seek

AI subtitles now send every line of the next 30 seconds at once, instead of one batch at a time. A line about to show before its AI translation arrives gets a Microsoft machine translation in the meantime. A line already on screen keeps that translation until it ends, and the transcript shows the AI translation at once. When three batches fail in a row, or Built-in AI refuses, translation stops: the machine translations are removed and the error stays on screen until you come back to the tab or change the subtitles provider. An OpenAI account with no balance now fails at once, instead of being retried as a rate limit for several minutes. Looking up a word in a subtitle now uses only the original line as context.
