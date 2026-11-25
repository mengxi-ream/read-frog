---
"@read-frog/extension": patch
---

fix(tts): when Chrome closes the audio player just as a sentence starts, reading aloud reopens it and plays the sentence instead of failing. If playback still fails, the toast says so in plain words instead of showing Chrome's message, and no uncaught error is left in the console. Pressing stop or starting other speech while the player reopens no longer lets the old audio play
