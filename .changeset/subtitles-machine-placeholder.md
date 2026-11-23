---
"@read-frog/extension": patch
---

feat(subtitles): show translations right away at the start of a video and after a seek

AI subtitles now send every line of the next 30 seconds at once, instead of one batch at a time. A line about to show before its AI translation arrives gets a Microsoft machine translation in the meantime. A line already on screen keeps that translation until it ends, and the transcript shows the AI translation at once. When three batches fail in a row, translation stops: the machine translations are removed and the error stays on screen until you come back to the tab or change the subtitles provider. When access is denied, such as when Built-in AI refuses or an OpenAI account has no balance, translation stops at the first failure. An OpenAI account with no balance is no longer retried as a rate limit for several minutes. In translation-only mode, a line that fails to translate now shows nothing until a machine translation arrives, instead of its original text. Looking up a word in a subtitle now uses only the original line as context.
