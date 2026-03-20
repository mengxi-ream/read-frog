import { afterEach, describe, expect, it, vi } from "vitest"

describe("google drive auth", () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.doUnmock("#imports")
  })

  it("does not read identity redirect URLs during module evaluation", async () => {
    const getRedirectURL = vi.fn(() => "https://example.com")

    vi.doMock("#imports", () => ({
      browser: {
        identity: {
          getRedirectURL,
          launchWebAuthFlow: vi.fn(),
        },
      },
      storage: {
        getItem: vi.fn(),
        removeItem: vi.fn(),
        setItem: vi.fn(),
      },
    }))

    await import("../auth")

    expect(getRedirectURL).not.toHaveBeenCalled()
  })

  it("returns a recognizable unsupported-platform error on Firefox Android", async () => {
    vi.stubEnv("BROWSER", "firefox")
    vi.stubEnv("WXT_FIREFOX_ANDROID", "true")

    const auth = await import("../auth")

    for (const action of [
      () => auth.authenticateGoogleDriveAndSaveTokenToStorage(),
      () => auth.getValidAccessToken(),
      () => auth.getIsAuthenticated(),
    ]) {
      try {
        await action()
        throw new Error("Expected Google Drive auth action to fail")
      }
      catch (error) {
        expect(auth.isGoogleDrivePlatformUnsupportedError(error)).toBe(true)
        expect(error).toMatchObject({
          code: auth.GOOGLE_DRIVE_PLATFORM_UNSUPPORTED_ERROR_CODE,
        })
      }
    }
  })
})
