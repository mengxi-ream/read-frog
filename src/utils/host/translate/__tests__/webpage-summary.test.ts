// @vitest-environment jsdom

import type { PromptableProviderRef } from "@/utils/providers/provider-ref"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn<(...args: any[]) => any>(),
}))

const localRef: PromptableProviderRef = {
  kind: "local",
  config: {
    id: "openai-default",
    name: "OpenAI",
    provider: "openai",
    enabled: true,
    apiKey: "sk-test",
    model: { model: "gpt-5-mini", isCustomModel: false, customModel: null },
  } as never,
}

const hostedRef: PromptableProviderRef = {
  kind: "system",
  providerId: "read-frog-advance-ai",
  modelTier: "advance",
  modelRevision: "advance-r1",
}

const webPageContext = {
  url: "https://example.com/article",
  webTitle: "Page title",
  webContent: "Page body",
}

describe("getOrGenerateWebPageSummary", () => {
  it("requests webpage summary through a dedicated background message", async () => {
    const { sendMessage } = await import("@/utils/message")
    vi.mocked(sendMessage).mockResolvedValue("Generated summary")

    const { getOrGenerateWebPageSummary } = await import("../webpage-summary")
    const result = await getOrGenerateWebPageSummary(
      webPageContext,
      localRef,
      true,
      "pageTranslation",
    )

    expect(result).toBe("Generated summary")
    expect(sendMessage).toHaveBeenCalledWith("getOrGenerateWebPageSummary", {
      webTitle: "Page title",
      webContent: "Page body",
      providerRef: localRef,
      hostedFeature: "pageTranslation",
    })
  })

  it("forwards a Built-in AI ref instead of refusing to summarize", async () => {
    // The old guard required an LLMProviderConfig, which silently skipped the
    // summary whenever Built-in AI was the page provider.
    const { sendMessage } = await import("@/utils/message")
    vi.mocked(sendMessage).mockResolvedValue("Hosted summary")

    const { getOrGenerateWebPageSummary } = await import("../webpage-summary")
    await expect(
      getOrGenerateWebPageSummary(webPageContext, hostedRef, true, "pageTranslation"),
    ).resolves.toBe("Hosted summary")
    expect(sendMessage).toHaveBeenCalledWith(
      "getOrGenerateWebPageSummary",
      expect.objectContaining({ providerRef: hostedRef }),
    )
  })

  it("forwards the triggering feature's route so gate and billing cannot diverge", async () => {
    // The background bills the summary against this route; hardcoding
    // pageTranslation there once let an input-translation summary gate on one
    // quota and bill another.
    const { sendMessage } = await import("@/utils/message")
    vi.mocked(sendMessage).mockResolvedValue("Summary")

    const { getOrGenerateWebPageSummary } = await import("../webpage-summary")
    await getOrGenerateWebPageSummary(webPageContext, hostedRef, true, "inputTranslation")

    expect(sendMessage).toHaveBeenLastCalledWith(
      "getOrGenerateWebPageSummary",
      expect.objectContaining({ hostedFeature: "inputTranslation" }),
    )
  })

  it("skips the round trip when AI content awareness is off or context is empty", async () => {
    const { sendMessage } = await import("@/utils/message")
    vi.mocked(sendMessage).mockClear()

    const { getOrGenerateWebPageSummary } = await import("../webpage-summary")
    await expect(
      getOrGenerateWebPageSummary(webPageContext, localRef, false, "pageTranslation"),
    ).resolves.toBeNull()
    await expect(
      getOrGenerateWebPageSummary(null, localRef, true, "pageTranslation"),
    ).resolves.toBeNull()
    await expect(
      getOrGenerateWebPageSummary(
        { ...webPageContext, webContent: "  " },
        localRef,
        true,
        "pageTranslation",
      ),
    ).resolves.toBeNull()

    expect(sendMessage).not.toHaveBeenCalled()
  })
})
