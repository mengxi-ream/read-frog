import type { Config } from "@/types/config/config"
import type { APIProviderConfig } from "@/types/config/provider"
import { describe, expect, it, vi } from "vitest"
import { initI18n } from "@/utils/i18n"
import { addProvider, duplicateProvider } from "../utils"

type AlibabaProviderConfig = Extract<APIProviderConfig, { provider: "alibaba" }>

describe("api provider utils", () => {
  it("adds the OpenAI-compatible provider with its localized default description", async () => {
    await initI18n("en")
    let updatedProviders: Config["providersConfig"] | undefined
    const setProvidersConfig = vi.fn<(...args: any[]) => any>(async (config) => {
      updatedProviders = config as Config["providersConfig"]
    })

    await addProvider("openai-compatible", [], setProvidersConfig)

    expect(updatedProviders?.[0]).toEqual(
      expect.objectContaining({
        provider: "openai-compatible",
        description: "options.apiProviders.providers.description.openaiCompatible",
      }),
    )
  })

  it("duplicates an existing provider config with a fresh id and unique name", async () => {
    const sourceProvider: AlibabaProviderConfig = {
      id: "alibaba-original",
      name: "Alibaba Cloud",
      description: "shared credentials",
      enabled: true,
      provider: "alibaba",
      apiKey: "[REDACTED]",
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      temperature: 0.3,
      providerOptions: { extraBody: { enable_thinking: false } },
      headers: { "x-test": "enabled" },
      model: {
        model: "qwen3-max",
        isCustomModel: true,
        customModel: "qwen3-max",
      },
    }
    const existingCopy: AlibabaProviderConfig = {
      ...sourceProvider,
      id: "alibaba-copy",
      name: "Alibaba Cloud 1",
    }
    const providersConfig = [sourceProvider, existingCopy] as Config["providersConfig"]
    let updatedProviders: Config["providersConfig"] | undefined
    const setProvidersConfig = vi.fn<(...args: any[]) => any>(
      async (config: Partial<Config["providersConfig"]>) => {
        updatedProviders = config as Config["providersConfig"]
      },
    )
    const setSelectedProviderId = vi.fn<(...args: any[]) => any>()

    const newProviderId = await duplicateProvider(
      sourceProvider,
      providersConfig,
      setProvidersConfig,
      setSelectedProviderId,
    )

    expect(newProviderId).not.toBe(sourceProvider.id)
    expect(setProvidersConfig).toHaveBeenCalledOnce()
    expect(updatedProviders).toHaveLength(3)

    const duplicatedProvider = updatedProviders?.[2] as AlibabaProviderConfig
    expect(duplicatedProvider).toEqual({
      ...sourceProvider,
      id: newProviderId,
      name: "Alibaba Cloud 2",
    })
    expect(duplicatedProvider).not.toBe(sourceProvider)
    expect(duplicatedProvider.model).not.toBe(sourceProvider.model)
    expect(duplicatedProvider.providerOptions).not.toBe(sourceProvider.providerOptions)
    expect(duplicatedProvider.headers).not.toBe(sourceProvider.headers)
    expect(setSelectedProviderId).toHaveBeenCalledWith(newProviderId)
  })
})
