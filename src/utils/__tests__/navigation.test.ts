import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import {
  buildProviderConfigRoute,
  buildProviderTypeConfigRoute,
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
