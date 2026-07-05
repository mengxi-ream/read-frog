---
"@read-frog/extension": minor
---

feat(subtitles): read subtitles aloud with Edge TTS

Adds an optional text-to-speech mode to Video Subtitles that speaks the
active subtitle cue as the video plays, reusing the existing Edge TTS
infrastructure.

- New `videoSubtitles.tts` config (enabled by default: off) with read target
  (translation / original), voice mode (auto / custom), rate offset, and a
  "pause with video" toggle.
- Follows the cue timeline: stops in-flight playback on cue change, pause,
  or seek; pre-synthesizes the next couple of cues to keep playback instant.
- Configurable from the in-player subtitles settings panel (new "Read Aloud"
  sub-page), with en / zh-CN copy. Migrates existing configs from v83 → v84.
