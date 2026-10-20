import type { LLMProviderConfig } from "@/types/config/provider"
import { afterEach, describe, expect, it, vi } from "vitest"
import { llmProviderConfigItemSchema } from "@/types/config/provider"
import {
  filterMiniMaxTextModels,
  getSelectableProviderModels,
  LLM_PROVIDER_MODELS,
} from "@/utils/constants/models"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { buildLocalGenerateTextParams } from "../generate-params"
import { getLanguageModelForConfig } from "../model"

const prompt = [
  { role: "user" as const, content: [{ type: "text" as const, text: "Translate hello" }] },
]

// Exercise the production factory and SDK serializer; only HTTP is replaced.
async function captureRequest(config: LLMProviderConfig, includeImage = false) {
  const fetchMock = vi.fn<typeof fetch>(async () =>
    Response.json({
      id: "test-completion",
      object: "chat.completion",
      created: 1,
      model: "test-model",
      choices: [
        { index: 0, message: { role: "assistant", content: "你好" }, finish_reason: "stop" },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
    }),
  )
  vi.stubGlobal("fetch", fetchMock)
  await getLanguageModelForConfig({ ...config, apiKey: "test-key" }).doGenerate({
    prompt: includeImage
      ? [
          {
            role: "user",
            content: [
              ...prompt[0]!.content,
              {
                type: "file",
                data: { type: "url", url: new URL("https://images.example/test.png") },
                mediaType: "image/png",
              },
            ],
          },
        ]
      : prompt,
    ...buildLocalGenerateTextParams(config),
  })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url, init] = fetchMock.mock.calls[0]!
  expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-key")
  return { url: String(url), body: JSON.parse(init!.body as string) }
}

afterEach(() => vi.unstubAllGlobals())

describe("MiniMax model choices", () => {
  it("filters fetched suggestions, orders Flash first, and preserves media and other models", () => {
    expect(
      filterMiniMaxTextModels([
        "minimax/minimax-m3",
        "other-model",
        "minimax/minimax-m2.7",
        "MiniMax-Text-01",
        "minimax/minimax-m3.1-flash:free",
        "speech-2.8-hd",
        "MiniMax-Music-2.5",
        "MiniMax-Hailuo-2.3",
        "image-01",
      ]),
    ).toEqual([
      "minimax/minimax-m3.1-flash:free",
      "other-model",
      "minimax/minimax-m3",
      "speech-2.8-hd",
      "MiniMax-Music-2.5",
      "MiniMax-Hailuo-2.3",
      "image-01",
    ])
    expect(filterMiniMaxTextModels(["minimax-m3.1-flash-free"])).toEqual([
      "minimax-m3.1-flash-free",
    ])
    expect(filterMiniMaxTextModels(["minimax/minimax-m3"])).toEqual(["minimax/minimax-m3"])
  })

  it("offers Flash first and M3 second without removing saved legacy IDs", () => {
    expect(getSelectableProviderModels("minimax")).toEqual(["MiniMax-M3.1-Flash", "MiniMax-M3"])
    expect(DEFAULT_PROVIDER_CONFIG.minimax.model.model).toBe("MiniMax-M3.1-Flash")
    for (const model of LLM_PROVIDER_MODELS.minimax) {
      const config = {
        ...DEFAULT_PROVIDER_CONFIG.minimax,
        model: { model, isCustomModel: false, customModel: null },
      }
      expect(llmProviderConfigItemSchema.safeParse(config).success).toBe(true)
      expect(getSelectableProviderModels("minimax", model)).toContain(model)
    }
  })

  it("filters legacy gateway MiniMax choices while preserving other models and their order", () => {
    for (const provider of Object.keys(
      LLM_PROVIDER_MODELS,
    ) as (keyof typeof LLM_PROVIDER_MODELS)[]) {
      const choices = getSelectableProviderModels(provider)
      const isMiniMax = (model: string) => /(?:^|\/)minimax-m/i.test(model)
      expect(
        choices
          .filter(isMiniMax)
          .every((model) => /(?:^|\/)minimax-m3(?:\.1-flash(?::free)?)?$/i.test(model)),
      ).toBe(true)
      expect(choices.filter((model) => !isMiniMax(model))).toEqual(
        LLM_PROVIDER_MODELS[provider].filter((model) => !isMiniMax(model)),
      )
    }
    expect(
      getSelectableProviderModels("openrouter").filter((model) => model.startsWith("minimax/")),
    ).toEqual(["minimax/minimax-m3.1-flash:free", "minimax/minimax-m3"])
    expect(getSelectableProviderModels("togetherai", "MiniMaxAI/MiniMax-M2.7")).toContain(
      "MiniMaxAI/MiniMax-M2.7",
    )
    expect(getSelectableProviderModels("minimax", "unlisted-model")).not.toContain("unlisted-model")
  })
})

describe("MiniMax HTTP request compatibility", () => {
  it("uses direct Flash with API-default adaptive thinking and max effort", async () => {
    const { url, body } = await captureRequest(DEFAULT_PROVIDER_CONFIG.minimax)
    expect(url).toBe("https://api.minimax.io/v1/chat/completions")
    expect(body.model).toBe("MiniMax-M3.1-Flash")
    expect(body.messages).toEqual([{ role: "user", content: "Translate hello" }])
    expect(body).not.toHaveProperty("thinking")
    expect(body).not.toHaveProperty("reasoning_effort")
    expect(body).not.toHaveProperty("reasoningEffort")
    expect(body).not.toHaveProperty("output_config")
    expect(body).not.toHaveProperty("reasoning_split")
    expect(body).not.toHaveProperty("service_tier")
  })

  it.each(["low", "medium", "high", "xhigh", "max"])(
    "serializes explicit %s effort and adaptive thinking",
    async (effort) => {
      const { body } = await captureRequest({
        ...DEFAULT_PROVIDER_CONFIG.minimax,
        providerOptions: { thinking: { type: "adaptive" }, reasoning_effort: effort },
      })
      expect(body.thinking).toEqual({ type: "adaptive" })
      expect(body.reasoning_effort).toBe(effort)
      expect(body).not.toHaveProperty("reasoningEffort")
      expect(body).not.toHaveProperty("output_config")
    },
  )

  it("keeps M3's supported non-thinking request", async () => {
    const { body } = await captureRequest({
      ...DEFAULT_PROVIDER_CONFIG.minimax,
      model: { model: "MiniMax-M3", isCustomModel: false, customModel: null },
    })
    expect(body.model).toBe("MiniMax-M3")
    expect(body.thinking).toEqual({ type: "disabled" })
  })

  it.each(["minimax/minimax-m3.1-flash:free", "minimax/minimax-m3"] as const)(
    "preserves the verified OpenRouter route %s",
    async (model) => {
      const { url, body } = await captureRequest({
        ...DEFAULT_PROVIDER_CONFIG.openrouter,
        model: { model, isCustomModel: false, customModel: null },
      })
      expect(url).toBe("https://openrouter.ai/api/v1/chat/completions")
      expect(body.model).toBe(model)
      expect(body).not.toHaveProperty("output_config")
      if (model.includes("flash")) expect(body).not.toHaveProperty("thinking")
    },
  )

  it.each(["https://api.minimax.io/v1", "https://api.minimaxi.com/v1"])(
    "keeps regional URL %s and image content",
    async (baseURL) => {
      const { url, body } = await captureRequest(
        { ...DEFAULT_PROVIDER_CONFIG.minimax, baseURL },
        true,
      )
      expect(url).toBe(`${baseURL}/chat/completions`)
      expect(body.messages[0].content).toEqual([
        { type: "text", text: "Translate hello" },
        { type: "image_url", image_url: { url: "https://images.example/test.png" } },
      ])
    },
  )

  it("preserves a saved legacy model, custom URL, and user options", async () => {
    const config = {
      ...DEFAULT_PROVIDER_CONFIG.minimax,
      baseURL: "https://custom.example/v1",
      model: { model: "MiniMax-M2.7" as const, isCustomModel: false, customModel: null },
      providerOptions: { reasoning_split: true },
    }
    const { url, body } = await captureRequest(config)
    expect(url).toBe("https://custom.example/v1/chat/completions")
    expect(body.model).toBe("MiniMax-M2.7")
    expect(body.reasoning_split).toBe(true)
    expect(llmProviderConfigItemSchema.safeParse(config).success).toBe(true)
  })

  it("preserves a custom model ID and an explicit empty options override", async () => {
    const { body } = await captureRequest({
      ...DEFAULT_PROVIDER_CONFIG.minimax,
      model: { model: "MiniMax-M3", isCustomModel: true, customModel: "saved-custom-model" },
      providerOptions: {},
    })
    expect(body.model).toBe("saved-custom-model")
    expect(body).not.toHaveProperty("thinking")
  })

  it("leaves a non-MiniMax OpenRouter default unchanged", async () => {
    const { body } = await captureRequest(DEFAULT_PROVIDER_CONFIG.openrouter)
    expect(body.model).toBe("google/gemma-4-31b-it:free")
    expect(body).not.toHaveProperty("thinking")
    expect(body).not.toHaveProperty("reasoning_effort")
  })
})
