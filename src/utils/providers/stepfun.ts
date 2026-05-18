import type { OpenAICompatibleProviderSettings } from "@ai-sdk/openai-compatible"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

export const STEPFUN_DEFAULT_BASE_URL = "https://api.stepfun.com/v1"

export type StepfunProviderSettings = Omit<OpenAICompatibleProviderSettings, "name" | "baseURL"> & {
  baseURL?: string
}

export function createStepfun(options: StepfunProviderSettings = {}) {
  const { baseURL, ...rest } = options
  return createOpenAICompatible({
    name: "stepfun",
    baseURL: baseURL ?? STEPFUN_DEFAULT_BASE_URL,
    ...rest,
  })
}
