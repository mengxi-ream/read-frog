import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import { synthesizeMiniMaxTTS } from "@/utils/server/minimax-tts"

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let index = 0; index < bytes.length; index++) {
    binary += String.fromCharCode(bytes[index]!)
  }
  return btoa(binary)
}

export function setupMiniMaxTTSMessageHandlers() {
  onMessage("minimaxTtsSynthesize", async (message) => {
    const response = await synthesizeMiniMaxTTS(message.data)
    if (!response.ok) {
      logger.warn("[Background][MiniMaxTTS] synthesize failed:", response.error)
      return response
    }

    return {
      ok: true as const,
      audioBase64: arrayBufferToBase64(response.audio),
      contentType: response.contentType,
    }
  })
}
