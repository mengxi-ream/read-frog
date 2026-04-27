import { browser } from "#imports"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getExtensionShortcutSettingsUrl, openExtensionShortcutSettings } from "../navigation"

describe("navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    browser.tabs.create = vi.fn().mockResolvedValue({})
  })

  it("uses the Chrome extension shortcut settings URL by default", () => {
    expect(getExtensionShortcutSettingsUrl("Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36")).toBe("chrome://extensions/shortcuts")
  })

  it("uses the Edge extension shortcut settings URL for Edge", () => {
    expect(getExtensionShortcutSettingsUrl("Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0")).toBe("edge://extensions/shortcuts")
  })

  it("uses Firefox add-ons as the closest shortcut-management entry point for Firefox", () => {
    expect(getExtensionShortcutSettingsUrl("Mozilla/5.0 Firefox/121.0")).toBe("about:addons")
  })

  it("opens the resolved shortcut settings URL in an active tab", async () => {
    await openExtensionShortcutSettings("Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36")

    expect(browser.tabs.create).toHaveBeenCalledWith({
      active: true,
      url: "chrome://extensions/shortcuts",
    })
  })
})
