---
"@read-frog/extension": minor
---

feat(subtitles): AI subtitles leave beta — Pro/Ultra minute quota with per-pool usage

AI subtitle transcription is out of beta: the "(Beta)" label, the beta pre-flight, and the Tally application form are gone. Requesting subtitles now needs a Pro or Ultra subscription — a free account gets an upgrade prompt instead of an application link, a lapsed payment is pointed at billing, and an unsupported video length gets its own message. The create request now reports the player's video duration so the server can check the quota before spending transcription time.

Every one of those walls now answers in place with a button you choose to press — "Log in", "Upgrade", "Update payment" — instead of a browser tab opening on its own mid-video. The plan and quota are checked before the subtitles flow starts, so a click that gets turned away leaves the subtitles you were already watching untouched, and running out of minutes now says when they come back. The "Loading AI subtitles" pill no longer stays pinned to the player after a refusal, and a refusal that arrives while the transcript is being fetched is translated instead of showing the server's raw English.

The options page quota section shows one usage bar per quota pool: the monthly subscription quota with its reset date, and — for launch-window subscribers — the one-time launch gift with its expiry date. Against an older server the section falls back to the single-bar totals it showed before.
