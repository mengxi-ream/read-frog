import { describe, expect, it } from "vitest"
import { apiProviderConfigItemSchema } from "../provider"

describe("provider request timeout config", () => {
  it("accepts requestTimeoutMs on API provider config", () => {
    const result = apiProviderConfigItemSchema.safeParse({
      id: "openai-compatible-default",
      name: "Custom Provider",
      enabled: true,
      provider: "openai-compatible",
      baseURL: "https://api.example.com/v1",
      requestTimeoutMs: 600_000,
      model: {
        model: "use-custom-model",
        isCustomModel: true,
        customModel: "hymt2-q4:latest",
      },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.requestTimeoutMs).toBe(600_000)
    }
  })
})
