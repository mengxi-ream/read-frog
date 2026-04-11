import type { CachedWebPageContext } from "@/utils/host/translate/webpage-context"
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
  it("truncates paragraph context tokens and trusts the canonical webpage content", () => {
    const contextText = "x".repeat(CUSTOM_ACTION_CONTEXT_CHAR_LIMIT + 128)
    const webPageContext: CachedWebPageContext = {
      url: "https://example.com/article",
      webTitle: "Example page",
      webContent: "y".repeat(CUSTOM_ACTION_CONTEXT_CHAR_LIMIT),
    }
    const plan = buildCustomActionExecutionPlan(
      createCustomActionRequest(),
      "Selected text",
      contextText,
      webPageContext,
    )

    expect(plan.error).toBeNull()
    expect(plan.executionContext?.promptTokens.paragraphs).toBe(
      contextText.slice(0, CUSTOM_ACTION_CONTEXT_CHAR_LIMIT),
    )
    expect(plan.executionContext?.promptTokens.webContent).toBe(
      webPageContext.webContent,
    )
    expect(plan.executionContext?.promptTokens.selection).toBe("Selected text")
  })
})
