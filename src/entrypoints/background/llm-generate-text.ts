import type {
  BackgroundGenerateTextPayload,
  BackgroundGenerateTextResponse,
} from "@/types/background-generate-text"
import { generateText } from "ai"
import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import { getModelById } from "@/utils/providers/model"

export async function runGenerateTextInBackground(
  payload: BackgroundGenerateTextPayload,
): Promise<BackgroundGenerateTextResponse> {
  const { providerId, ...generateTextParams } = payload
  const model = await getModelById(providerId)

  const { text } = await generateText({
    ...generateTextParams,
    model,
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
