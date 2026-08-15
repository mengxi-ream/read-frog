import { describe, expect, it } from "vitest"
import { getProviderHeadersWithOverride } from "../headers"

describe("provider headers", () => {
  it("sends the user's own headers for a provider with none forced", () => {
    expect(getProviderHeadersWithOverride("openai", { "X-Test": "1" })).toEqual({
      "X-Test": "1",
    })
  })

  it("sends nothing when a provider with none forced has no configured headers", () => {
    expect(getProviderHeadersWithOverride("openai", undefined)).toBeUndefined()
    expect(getProviderHeadersWithOverride("openai", {})).toBeUndefined()
  })

  it("filters empty and non-string header values", () => {
    expect(
      getProviderHeadersWithOverride("openai", {
        "X-Empty": "",
        "X-Count": 1,
        "X-Test": "1",
      }),
    ).toEqual({
      "X-Test": "1",
    })
  })

  describe("forced headers", () => {
    const jalapeno = {
      "HTTP-Referer": "https://www.readfrog.app",
      "X-Jalapeno-Title": "Read Frog",
    }

    it("sends them when the user has configured no headers", () => {
      expect(getProviderHeadersWithOverride("jalapenocloud", undefined)).toEqual(jalapeno)
    })

    it("keeps them alongside the user's own headers", () => {
      expect(getProviderHeadersWithOverride("jalapenocloud", { "X-Test": "1" })).toEqual({
        "X-Test": "1",
        ...jalapeno,
      })
    })

    it("survives a user override that clears every header", () => {
      expect(getProviderHeadersWithOverride("jalapenocloud", {})).toEqual(jalapeno)
    })

    it("wins over a user header of the same name", () => {
      expect(
        getProviderHeadersWithOverride("jalapenocloud", { "HTTP-Referer": "https://evil.test" }),
      ).toEqual(jalapeno)
    })

    // Regression: this header used to be a config-time default, so adding any header of your own
    // dropped it — and Anthropic then refuses the request outright.
    it("keeps Anthropic's browser-access header when the user adds their own", () => {
      expect(getProviderHeadersWithOverride("anthropic", { "X-Test": "1" })).toEqual({
        "X-Test": "1",
        "anthropic-dangerous-direct-browser-access": "true",
      })
    })

    it("keeps OpenRouter attribution when the user adds their own", () => {
      expect(getProviderHeadersWithOverride("openrouter", { "X-Test": "1" })).toEqual({
        "X-Test": "1",
        "HTTP-Referer": "https://www.readfrog.app",
        "X-OpenRouter-Title": "Read Frog",
      })
    })
  })
})
