import { describe, expect, it, onTestFinished, vi } from "vitest"
import { browser } from "#imports"
import { authenticateGoogleDriveAndSaveTokenToStorage, isGoogleDriveSyncSupported } from "../auth"

describe("google drive auth", () => {
  // Safari has no identity API at all, and the settings page's opening screen
  // imports this module.
  it("loads in a browser without an identity API, and says sync isn't supported there", async () => {
    vi.resetModules()
    // The browser a fresh copy of the module gets.
    const fresh = await import("wxt/browser")
    const { identity } = fresh.browser
    Object.assign(fresh.browser, { identity: undefined })
    onTestFinished(() => {
      Object.assign(fresh.browser, { identity })
    })

    const auth = await import("../auth")

    expect(auth.isGoogleDriveSyncSupported()).toBe(false)
  })

  it("signs in through the browser, coming back to the extension's redirect URL", async () => {
    vi.spyOn(browser.identity, "getRedirectURL").mockReturnValue("https://extension-id.example/")
    // A spy takes the callback overload's type, so an implementation stands in
    // for mockResolvedValue.
    const launchWebAuthFlow = vi
      .spyOn(browser.identity, "launchWebAuthFlow")
      .mockImplementation(async () => "https://extension-id.example/#access_token=token-1")

    expect(isGoogleDriveSyncSupported()).toBe(true)
    await expect(authenticateGoogleDriveAndSaveTokenToStorage()).resolves.toBe("token-1")
    const authUrl = new URL(launchWebAuthFlow.mock.calls[0]![0].url)
    expect(authUrl.searchParams.get("redirect_uri")).toBe("https://extension-id.example/")
  })
})
