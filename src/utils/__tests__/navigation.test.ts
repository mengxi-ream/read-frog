import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { openOptionsPage } from "../navigation"

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
