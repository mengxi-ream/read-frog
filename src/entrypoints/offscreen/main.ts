import { setupExtensionPageLogging } from "@/utils/logging/setup"
import { onMessage } from "@/utils/message"
import { DOMAudioPlaybackController } from "@/utils/tts-playback/dom-audio-controller"

setupExtensionPageLogging("offscreen")

const playbackController = new DOMAudioPlaybackController(
  "Failed to play audio in offscreen document",
)

onMessage("ttsOffscreenPlay", async (message) => {
  return playbackController.play(message.data)
})

onMessage("ttsOffscreenStop", async (message) => {
  playbackController.stop(message.data)
  return { ok: true as const }
})
