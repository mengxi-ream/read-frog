import type {
  BackgroundGenerateTextPayload,
  BackgroundGenerateTextResponse,
} from "@/types/background-generate-text"
import { generateText } from "ai"
import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import { withLanguageModelByIdAPIKeyRotation } from "@/utils/providers/model"

export async function runGenerateTextInBackground(
  payload: BackgroundGenerateTextPayload,
): Promise<BackgroundGenerateTextResponse> {
  const { providerId, ...generateTextParams } = payload

  const text = await withLanguageModelByIdAPIKeyRotation(providerId, async (model) => {
    const { text: result } = await generateText({
      ...generateTextParams,
      model,
    })
    return result
  })

  return { text }
}

export function setupLLMGenerateTextMessageHandlers() {
  onMessage("backgroundGenerateText", async (message) => {
    try {
      return await runGenerateTextInBackground(message.data)
    }
    catch (error) {
      logger.error("[Background] backgroundGenerateText failed", error)
      throw error
    }
  })
}
