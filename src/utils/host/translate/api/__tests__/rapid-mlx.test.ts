import process from "node:process"
import { afterEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { apiProviderConfigItemSchema } from "@/types/config/provider"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import { DEFAULT_PROVIDER_CONFIG, PROVIDER_URL_PLACEHOLDERS } from "@/utils/constants/providers"
import { getProviderModelsURL } from "@/utils/providers/models-url"
import { aiTranslate } from "../ai"

const config = DEFAULT_PROVIDER_CONFIG["rapid-mlx"]
const promptResolver = async (language: string, text: string) => ({
  systemPrompt: `Translate into ${language}. Return only the translation.`,
  prompt: text,
})

async function translate() {
  await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, { providersConfig: [config] })
  return aiTranslate("Hello, world!", "Spanish", config, promptResolver, {
    signal: AbortSignal.timeout(60_000),
  })
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await storage.removeItem(`local:${CONFIG_STORAGE_KEY}`)
})

describe("Rapid-MLX", () => {
  it("provides local defaults and allows custom model IDs", () => {
    expect(config.baseURL).toBe("http://localhost:8000/v1")
    expect(config.apiKey).toBe("rapid-mlx")
    expect(PROVIDER_URL_PLACEHOLDERS["rapid-mlx"]).toBe(config.baseURL)
    expect(getProviderModelsURL(config)).toBe("http://localhost:8000/v1/models")
    expect(
      apiProviderConfigItemSchema.parse({
        ...config,
        model: { ...config.model, isCustomModel: true, customModel: "my-local-model" },
      }),
    ).toMatchObject({ model: { customModel: "my-local-model" } })
  })

  it("translates through the OpenAI-compatible SDK adapter", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        id: "rapid-mlx-test",
        model: config.model.model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Hola, mundo!" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)
    expect(await translate()).toBe("Hola, mundo!")
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("http://localhost:8000/v1/chat/completions")
    expect(new Headers(init!.headers).get("authorization")).toBe("Bearer rapid-mlx")
    expect(JSON.parse(init!.body as string)).toMatchObject({
      model: config.model.model,
      messages: [
        { role: "system", content: expect.stringContaining("Spanish") },
        { role: "user", content: "Hello, world!" },
      ],
    })
  })

  it.skipIf(process.env.RAPID_MLX_E2E !== "true")(
    "translates against the live local server",
    async () => {
      const result = await translate()
      process.stdout.write(`Rapid-MLX translation: ${result}\n`)
      expect(result).toMatch(/hola.*mundo/i)
    },
    65_000,
  )
})
