import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import { listGeminiTTSVoices, synthesizeGeminiTTS } from "@/utils/server/gemini-tts"

export function setupGeminiTTSMessageHandlers() {
  onMessage("geminiTtsSynthesize", async (message) => {
    const response = await synthesizeGeminiTTS(message.data)
    if (!response.ok) {
      logger.warn("[Background][GeminiTTS] synthesize failed:", response.error)
    }
    return response
  })

  onMessage("geminiTtsListVoices", async (message) => {
    const response = await listGeminiTTSVoices(message.data)
    if (!response.ok) {
      logger.warn("[Background][GeminiTTS] list voices failed:", response.error)
    }
    return response
  })
}
