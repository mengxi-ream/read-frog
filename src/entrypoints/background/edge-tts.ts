import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import { getEdgeTTSHealthStatus, listEdgeTTSVoices, synthesizeEdgeTTS } from "@/utils/server/edge-tts"

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let index = 0; index < bytes.length; index++) {
    binary += String.fromCharCode(bytes[index]!)
  }
  return btoa(binary)
}

export function setupEdgeTTSMessageHandlers() {
  onMessage("edgeTtsSynthesize", async (message) => {
    const response = await synthesizeEdgeTTS(message.data)
    if (!response.ok) {
      logger.warn("[Background][EdgeTTS] synthesize failed:", response.error)
      return response
    }

    return {
      ok: true as const,
      audioBase64: arrayBufferToBase64(response.audio),
      contentType: response.contentType,
    }
  })

  onMessage("edgeTtsListVoices", async () => {
    return listEdgeTTSVoices()
  })

  onMessage("edgeTtsHealthCheck", async () => {
    return getEdgeTTSHealthStatus()
  })
}
