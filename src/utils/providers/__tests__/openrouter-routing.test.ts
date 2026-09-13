import { describe, expect, it } from "vitest"
import { getOpenRouterProviderRouting, parseOpenRouterProviderSlugs } from "../openrouter-routing"

describe("parseOpenRouterProviderSlugs", () => {
  it("splits on commas and trims surrounding whitespace", () => {
    expect(parseOpenRouterProviderSlugs(" deepinfra , together ")).toEqual([
      "deepinfra",
      "together",
    ])
  })

  it("drops empty entries left by stray or trailing commas", () => {
    expect(parseOpenRouterProviderSlugs("deepinfra,,together,")).toEqual(["deepinfra", "together"])
  })

  it("keeps the first occurrence of a duplicated slug", () => {
    expect(parseOpenRouterProviderSlugs("together, deepinfra, together")).toEqual([
      "together",
      "deepinfra",
    ])
  })

  it("keeps endpoint variants and region slugs verbatim", () => {
    expect(parseOpenRouterProviderSlugs("deepinfra/turbo, google-vertex/us-east5")).toEqual([
      "deepinfra/turbo",
      "google-vertex/us-east5",
    ])
  })

  it("returns an empty list for an absent or blank value", () => {
    expect(parseOpenRouterProviderSlugs(undefined)).toEqual([])
    expect(parseOpenRouterProviderSlugs("")).toEqual([])
    expect(parseOpenRouterProviderSlugs("  ,  ")).toEqual([])
  })
})

describe("getOpenRouterProviderRouting", () => {
  it("locks to the listed providers and disables fallbacks", () => {
    expect(getOpenRouterProviderRouting({ only: "deepinfra, together" })).toEqual({
      only: ["deepinfra", "together"],
      allow_fallbacks: false,
    })
  })

  it("returns undefined when no provider is locked", () => {
    expect(getOpenRouterProviderRouting(undefined)).toBeUndefined()
    expect(getOpenRouterProviderRouting({})).toBeUndefined()
    expect(getOpenRouterProviderRouting({ only: " , " })).toBeUndefined()
  })
})
