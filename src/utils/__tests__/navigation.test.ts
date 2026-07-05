import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { openOptionsPage } from "../navigation"

describe("navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    browser.runtime.openOptionsPage = vi.fn().mockResolvedValue(undefined)
    browser.tabs.create = vi.fn().mockResolvedValue({})
  })

  it("opens the options page through the runtime API", async () => {
    await openOptionsPage()

    expect(browser.runtime.openOptionsPage).toHaveBeenCalledOnce()
    expect(browser.tabs.create).not.toHaveBeenCalled()
  })

  it("falls back to an extension tab when the runtime API fails", async () => {
    browser.runtime.openOptionsPage = vi.fn().mockRejectedValue(new Error("failed"))

    await openOptionsPage()

    expect(browser.tabs.create).toHaveBeenCalledWith({
      active: true,
      url: "chrome-extension://test-extension-id/options.html",
    })
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
