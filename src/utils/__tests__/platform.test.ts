import { afterEach, describe, expect, it, vi } from "vitest"

async function loadPlatformModule(
  browser: string,
  wxtFirefoxAndroid?: string,
) {
  vi.resetModules()
  vi.unstubAllEnvs()
  vi.stubEnv("BROWSER", browser)

  if (wxtFirefoxAndroid !== undefined) {
    vi.stubEnv("WXT_FIREFOX_ANDROID", wxtFirefoxAndroid)
  }

  return import("../platform")
}

describe("platform capabilities", () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it("detects Firefox Android builds", async () => {
    const platform = await loadPlatformModule("firefox", "true")

    expect(platform.isFirefoxAndroidBuild).toBe(true)
    expect(platform.supportsContextMenu).toBe(false)
    expect(platform.supportsGoogleDriveSync).toBe(false)
  })

  it("keeps desktop Firefox capabilities enabled", async () => {
    const platform = await loadPlatformModule("firefox")

    expect(platform.isFirefoxAndroidBuild).toBe(false)
    expect(platform.supportsContextMenu).toBe(true)
    expect(platform.supportsGoogleDriveSync).toBe(true)
  })
})
