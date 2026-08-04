import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import {
  OpenAICompatibleTTSHTTPError,
  synthesizeOpenAICompatibleTTS,
} from "@/utils/server/openai-compatible-tts"

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let index = 0; index < bytes.length; index++) {
    binary += String.fromCharCode(bytes[index]!)
  }
  return btoa(binary)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown TTS error"
}

export function setupOpenAICompatibleTTSMessageHandlers() {
  onMessage("openAICompatibleTtsSynthesize", async (message) => {
    try {
      const result = await synthesizeOpenAICompatibleTTS(message.data.text, message.data.config)
      return {
        ok: true as const,
        audioBase64: arrayBufferToBase64(result.audio),
        contentType: result.contentType,
      }
    } catch (error) {
      logger.warn("[Background][OpenAICompatibleTTS] synthesize failed:", error)

      if (error instanceof OpenAICompatibleTTSHTTPError) {
        return {
          ok: false as const,
          error: {
            code: "REQUEST_FAILED" as const,
            message: error.message,
            status: error.status,
          },
        }
      }

      const errorMessage = getErrorMessage(error)
      const isInvalidConfig =
        errorMessage.startsWith("Base URL") || errorMessage === "Text to speech input is empty"
      const isEmptyAudio = errorMessage === "TTS API returned empty audio data"
      return {
        ok: false as const,
        error: {
          code: isInvalidConfig
            ? ("INVALID_CONFIG" as const)
            : isEmptyAudio
              ? ("EMPTY_AUDIO" as const)
              : ("NETWORK_ERROR" as const),
          message: errorMessage,
        },
      }
    }
  })
}
