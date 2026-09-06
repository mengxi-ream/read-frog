import type {
  BackgroundGenerateTextPayload,
  BackgroundGenerateTextResponse,
} from "@/types/background-generate-text"
import { validateProviderHostedFeature } from "@/utils/hosted-ai/routing"
import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"
import { generateTextForProviderRef } from "./background-stream"

export async function runGenerateTextInBackground(
  payload: BackgroundGenerateTextPayload,
): Promise<BackgroundGenerateTextResponse> {
  validateProviderHostedFeature(payload.providerRef, payload.hostedFeature)
  return { text: await generateTextForProviderRef(payload) }
}

export function setupLLMGenerateTextMessageHandlers() {
  onMessage("backgroundGenerateText", async (message) => {
    try {
      return await runGenerateTextInBackground(message.data)
    } catch (error) {
      logger.error("[Background] backgroundGenerateText failed", error)
      throw error
    }
  })
}
