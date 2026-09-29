import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import {
  buildAddCustomActionOptionsRoute,
  buildCustomActionOptionsRoute,
  buildProviderConfigRoute,
  buildProviderTypeConfigRoute,
  consumeCustomActionDeepLink,
  CUSTOM_ACTION_ADD_QUERY_PARAM,
  getRequestedProviderType,
  openOptionsPage,
  shouldHighlightApiKey,
} from "../navigation"

describe("navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    browser.runtime.openOptionsPage = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    browser.tabs.create = vi.fn<(...args: any[]) => any>().mockResolvedValue({})
  })

  it("opens the options page as an extension tab", async () => {
    await openOptionsPage()

    expect(browser.tabs.create).toHaveBeenCalledWith({
      active: true,
      url: "chrome-extension://test-extension-id/options.html",
    })
    expect(browser.runtime.openOptionsPage).not.toHaveBeenCalled()
  })

  it("falls back to the runtime API when opening an extension tab fails", async () => {
    browser.tabs.create = vi.fn<(...args: any[]) => any>().mockRejectedValue(new Error("failed"))

    await openOptionsPage()

    expect(browser.runtime.openOptionsPage).toHaveBeenCalledOnce()
  })

  it("opens the options page with a hash route", async () => {
    await openOptionsPage({ route: "/custom-actions?actionId=action-1" })

    expect(browser.runtime.openOptionsPage).not.toHaveBeenCalled()
    expect(browser.tabs.create).toHaveBeenCalledWith({
      active: true,
      url: "chrome-extension://test-extension-id/options.html#/custom-actions?actionId=action-1",
    })
  })
})

describe("provider config routes", () => {
  it("addresses a provider by id", () => {
    expect(buildProviderConfigRoute("provider-1")).toBe(
      "/api-providers?section=provider-config&provider=provider-1",
    )
  })

  it("addresses a provider by type", () => {
    expect(buildProviderTypeConfigRoute("openai")).toBe(
      "/api-providers?section=provider-config&providerType=openai",
    )
  })

  it("asks for the API key highlight only when requested", () => {
    expect(buildProviderTypeConfigRoute("openai", { highlightApiKey: true })).toBe(
      "/api-providers?section=provider-config&providerType=openai&highlight=apiKey",
    )
    expect(buildProviderConfigRoute("provider-1", { highlightApiKey: false })).not.toContain(
      "highlight",
    )
  })

  it("reads back what it wrote", () => {
    const search = new URL(
      `https://x${buildProviderTypeConfigRoute("deepseek", { highlightApiKey: true })}`,
    ).search

    expect(getRequestedProviderType(search)).toBe("deepseek")
    expect(shouldHighlightApiKey(search)).toBe(true)
  })

  it("treats a blank or absent provider type as no request", () => {
    expect(getRequestedProviderType("?providerType=%20%20")).toBeNull()
    expect(getRequestedProviderType("?section=provider-config")).toBeNull()
  })

  it("highlights nothing for an unknown highlight target", () => {
    expect(shouldHighlightApiKey("?highlight=password")).toBe(false)
    expect(shouldHighlightApiKey("")).toBe(false)
  })
})

describe("custom action routes", () => {
  it("builds the route-only form, with and without a tab", () => {
    expect(buildCustomActionOptionsRoute("action 1")).toBe("/custom-actions?actionId=action%201")
    expect(buildCustomActionOptionsRoute("action-1", { tab: "notebase" })).toBe(
      "/custom-actions?actionId=action-1&tab=notebase",
    )
  })

  it("builds the full options page form", () => {
    expect(buildCustomActionOptionsRoute("action-1", { tab: "notebase", full: true })).toBe(
      "/options.html#/custom-actions?actionId=action-1&tab=notebase",
    )
    expect(buildCustomActionOptionsRoute("a&b", { full: true })).toBe(
      "/options.html#/custom-actions?actionId=a%26b",
    )
  })

  it("reads back what it wrote", () => {
    const route = buildCustomActionOptionsRoute("a&b c", { tab: "notebase" })
    const search = route.slice(route.indexOf("?"))

    expect(consumeCustomActionDeepLink(search)).toEqual({
      actionId: "a&b c",
      tab: "notebase",
      remainingSearch: "",
    })
  })

  it("links to the add action dialog, and strips that param too", () => {
    const route = buildAddCustomActionOptionsRoute()
    const search = route.slice(route.indexOf("?"))

    expect(route.startsWith("/custom-actions?")).toBe(true)
    expect(new URLSearchParams(search).has(CUSTOM_ACTION_ADD_QUERY_PARAM)).toBe(true)
    expect(consumeCustomActionDeepLink(search)).toEqual({
      actionId: null,
      tab: null,
      remainingSearch: "",
    })
  })

  it("strips its own params and keeps the rest", () => {
    expect(
      consumeCustomActionDeepLink("?section=custom-actions&actionId=x&tab=config&addAction=1"),
    ).toEqual({ actionId: "x", tab: "config", remainingSearch: "?section=custom-actions" })
  })

  it("is a no-op the second time, so a link is applied once", () => {
    const first = consumeCustomActionDeepLink("?actionId=x&tab=notebase&section=s")

    expect(first?.remainingSearch).toBe("?section=s")
    expect(consumeCustomActionDeepLink(first!.remainingSearch)).toBeNull()
    expect(consumeCustomActionDeepLink("")).toBeNull()
  })

  it("drops a tab it does not know, and a blank action id", () => {
    expect(consumeCustomActionDeepLink("?actionId=%20&tab=layout")).toEqual({
      actionId: null,
      tab: null,
      remainingSearch: "",
    })
    expect(consumeCustomActionDeepLink("?tab=notebase")?.tab).toBe("notebase")
  })
})
