import { Buffer } from "node:buffer"
import { generateText, Output, streamText } from "ai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { getProviderIdsForCapability } from "../provider-registry"

const fetchMock = vi.fn<typeof fetch>()
let updateRules: ReturnType<typeof vi.fn>
let model: ReturnType<typeof import("../model").getLanguageModelForConfig>
let transport: typeof fetch
const ENDPOINT = "https://index-translate.bilibili.com/v1/chat/completions"

function completion(content: string) {
  const body = {
    id: "test",
    created: 1,
    model: "Index-Translate-35B-A3B",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  }
  // The shared TextEncoder shim truncates non-ASCII characters. Supply UTF-8
  // bytes so the SDK receives the same response body on every Node version.
  return new Response(Buffer.from(JSON.stringify(body), "utf8"), {
    headers: { "Content-Type": "application/json" },
  })
}

function streamingCompletion(content: string) {
  const chunks = [
    { choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] },
    { choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
  ].map(
    (chunk) =>
      `data: ${JSON.stringify({ id: "test", created: 1, model: "Index-Translate-35B-A3B", ...chunk })}\n\n`,
  )
  return new Response(Buffer.from(chunks.join("") + "data: [DONE]\n\n", "utf8"), {
    headers: { "Content-Type": "text/event-stream" },
  })
}

describe("Bilibili model integration", () => {
  beforeEach(async () => {
    vi.resetModules()
    const { fakeBrowser } = await import("wxt/testing/fake-browser")
    updateRules = vi
      .spyOn(fakeBrowser.declarativeNetRequest, "updateDynamicRules")
      .mockResolvedValue(undefined)
    vi.spyOn(fakeBrowser.runtime, "getURL").mockReturnValue("moz-extension://extension-uuid/")
    fetchMock.mockReset().mockImplementation(async () => completion("你好"))
    vi.stubGlobal("fetch", fetchMock)
    transport = (await import("../bilibili")).bilibiliFetch
    model = (await import("../model")).getLanguageModelForConfig(
      DEFAULT_PROVIDER_CONFIG["bilibili-translate"],
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it.each([
    "pageTranslation",
    "selectionTranslation",
    "videoSubtitles",
    "inputTranslation",
    "noteSuggestion",
    "customAction",
    "languageDetection",
  ] as const)("is selectable for %s", (capability) => {
    expect(
      getProviderIdsForCapability(capability, [DEFAULT_PROVIDER_CONFIG["bilibili-translate"]]),
    ).toContain("bilibili-translate-default")
  })

  it("runs the actual SDK without a key and installs a scoped Origin rule", async () => {
    const result = await generateText({
      model,
      prompt: "Translate hello into Chinese",
      maxRetries: 0,
    })
    expect(result.text).toBe("你好")
    expect(updateRules).toHaveBeenCalledWith({
      removeRuleIds: [2309],
      addRules: [
        {
          id: 2309,
          priority: 1,
          action: {
            type: "modifyHeaders",
            requestHeaders: [{ header: "Origin", operation: "remove" }],
          },
          condition: {
            urlFilter: `|${ENDPOINT}|`,
            initiatorDomains: ["extension-uuid"],
            resourceTypes: ["xmlhttprequest"],
          },
        },
      ],
    })
    const [, init] = fetchMock.mock.calls[0]!
    expect(new Headers(init?.headers).has("Authorization")).toBe(false)
    expect(init?.credentials).toBe("omit")
    expect(JSON.parse(init!.body as string)).toMatchObject({
      max_tokens: 4096,
      chat_template_kwargs: { enable_thinking: false },
    })
  })

  it.each(["dictionary", "sentence analysis", "writing improvement", "note suggestion"])(
    "preserves structured streaming for %s",
    async (action) => {
      const output = { result: `有效的 ${action} 结果` }
      fetchMock.mockImplementation(async () => streamingCompletion(JSON.stringify(output)))
      const result = streamText({
        model,
        instructions: `Perform ${action}`,
        prompt: "Read the selected text",
        output: Output.object({ schema: z.object({ result: z.string() }) }),
        maxRetries: 0,
      })
      expect(await result.output).toEqual(output)
      const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
      expect(body.stream).toBe(true)
      expect(body.response_format.type).toBe("json_schema")
      expect(body.messages[0]).toEqual({ role: "system", content: `Perform ${action}` })
    },
  )

  it("keeps long instructions intact instead of breaking structured context into chunks", async () => {
    const instructions = "context ".repeat(600)
    await generateText({
      model,
      instructions,
      prompt: "Summarize",
      maxRetries: 0,
      maxOutputTokens: 8000,
    })
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
    expect(body.messages[0].content).toBe(instructions)
    expect(body.max_tokens).toBe(4096)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("waits for rule installation, retries failed setup, and honors cancellation", async () => {
    updateRules.mockRejectedValueOnce(new Error("rule failed"))
    await expect(transport(ENDPOINT, { body: "{}" })).rejects.toThrow("rule failed")
    expect(fetchMock).not.toHaveBeenCalled()
    const controller = new AbortController()
    let ready!: () => void
    updateRules.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          ready = resolve
        }),
    )
    const pending = transport(ENDPOINT, { body: "{}", signal: controller.signal })
    controller.abort()
    ready()
    await expect(pending).rejects.toMatchObject({ name: "AbortError" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not modify requests to a user-configured self-hosted endpoint", async () => {
    const init = { body: "{}", method: "POST" }
    await transport("https://self-hosted.example/v1/chat/completions", init)
    expect(updateRules).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith("https://self-hosted.example/v1/chat/completions", init)
  })
})
