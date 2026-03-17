// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { isLLMProviderConfig } from "@/types/config/provider"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CUSTOM_ACTION_CONTEXT_CHAR_LIMIT } from "../../../utils"
import { buildCustomActionExecutionPlan } from "../use-custom-action-execution"

function createCustomActionRequest() {
  const action = DEFAULT_CONFIG.selectionToolbar.customActions[0]
  if (!action) {
    throw new Error("Default custom action is missing")
  }

  const providerConfig = DEFAULT_CONFIG.providersConfig.find(provider =>
    provider.id === action.providerId,
  )

  if (!providerConfig || !isLLMProviderConfig(providerConfig)) {
    throw new Error("Default custom action provider must be an enabled LLM provider")
  }

  return {
    language: DEFAULT_CONFIG.language,
    action,
    providerConfig,
  }
}

describe("buildCustomActionExecutionPlan", () => {
  it("truncates long context tokens before passing them into custom action prompts", () => {
    const contextText = "x".repeat(CUSTOM_ACTION_CONTEXT_CHAR_LIMIT + 128)
    const plan = buildCustomActionExecutionPlan(
      createCustomActionRequest(),
      "Selected text",
      contextText,
    )

    expect(plan.error).toBeNull()
    expect(plan.executionContext?.promptTokens.paragraphs).toBe(
      contextText.slice(0, CUSTOM_ACTION_CONTEXT_CHAR_LIMIT),
    )
    expect(plan.executionContext?.promptTokens.selection).toBe("Selected text")
  })
})
