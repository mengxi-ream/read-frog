---
"@read-frog/extension": minor
---

feat(hosted-ai): show a failed Built-in AI request's ID, with a button that copies it

When a Built-in AI request fails, the error now shows its request ID with a copy button beside it. Put the ID in a bug report and we can find that exact request. It shows wherever the error does: the selection toolbar's translation and AI action panels, the word lookup card in video subtitles, the Translation Hub cards, the error card of a paragraph page translation could not translate, the error under a video's subtitles (with the ID in its tooltip), the failed video summary in the subtitles sidebar, and the message when a translated subtitles download fails. Input translation used to fail without a word when Built-in AI had a problem; it now says so in a message with the ID. Messages that already say what to do, such as log in, upgrade, quota used up or try another model, show no ID, and neither do errors from your own API keys or the free translation services.
