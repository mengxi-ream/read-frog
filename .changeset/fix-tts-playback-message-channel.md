---
"@read-frog/extension": patch
---

fix(tts): reading aloud no longer leaves an uncaught error in the console when the audio player closes mid-playback, the toast says so in plain words instead of showing Chrome's message, and pressing stop or starting other speech while the player restarts no longer lets the old audio play
