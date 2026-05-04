import { describe, expect, it } from "vitest"
import {
  getDefaultProviderHeaders,
  getProviderHeadersWithOverride,
} from "../headers"

describe("provider headers", () => {
  it("returns default headers for Anthropic", () => {
    expect(getDefaultProviderHeaders("anthropic")).toEqual({
      "anthropic-dangerous-direct-browser-access": "true",
    })
  })

  it("returns undefined for providers without default headers", () => {
    expect(getDefaultProviderHeaders("openai")).toBeUndefined()
  })

  it("falls back to default headers only when user headers are undefined", () => {
    expect(getProviderHeadersWithOverride("anthropic")).toEqual({
      "anthropic-dangerous-direct-browser-access": "true",
    })
  })

  it("uses user headers as a full override without merging defaults", () => {
    expect(getProviderHeadersWithOverride("anthropic", { "X-Test": "1" })).toEqual({
      "X-Test": "1",
    })
  })

  it("treats an explicit empty object as a user override that disables defaults", () => {
    expect(getProviderHeadersWithOverride("anthropic", {})).toBeUndefined()
  })

  it("filters empty and non-string header values", () => {
    expect(getProviderHeadersWithOverride("openai", {
      "X-Empty": "",
      "X-Count": 1,
      "X-Test": "1",
    })).toEqual({
      "X-Test": "1",
    })
  })
})
