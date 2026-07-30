import { describe, expect, it } from "vitest"
import { providerRequiresApiKey } from "../api-key"

describe("providerRequiresApiKey", () => {
  it("does not require an API key for Codex OAuth", () => {
    expect(providerRequiresApiKey("openai-codex")).toBe(false)
  })

  it("keeps API keys required for ordinary hosted providers", () => {
    expect(providerRequiresApiKey("openai")).toBe(true)
  })
})
