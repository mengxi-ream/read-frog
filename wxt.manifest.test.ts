import { describe, expect, it } from "vitest"
import { createExtensionManifest } from "./wxt.manifest"

describe("createExtensionManifest", () => {
  it("keeps desktop Firefox permissions unchanged", () => {
    const manifest = createExtensionManifest({
      browser: "firefox",
      mode: "production",
      isFirefoxAndroidBuild: false,
    })

    expect(manifest.permissions).toContain("contextMenus")
    expect(manifest.permissions).toContain("identity")
    expect(manifest.permissions).not.toContain("offscreen")
    expect(manifest.browser_specific_settings).toMatchObject({
      gecko: {
        id: "{bd311a81-4530-4fcc-9178-74006155461b}",
      },
    })
    expect(manifest.browser_specific_settings).not.toHaveProperty("gecko_android")
  })

  it("builds a Firefox Android manifest without unsupported permissions", () => {
    const manifest = createExtensionManifest({
      browser: "firefox",
      mode: "production",
      isFirefoxAndroidBuild: true,
    })

    expect(manifest.permissions).not.toContain("contextMenus")
    expect(manifest.permissions).not.toContain("identity")
    expect(manifest.permissions).toEqual(expect.arrayContaining([
      "storage",
      "tabs",
      "alarms",
      "cookies",
      "scripting",
      "webNavigation",
    ]))
    expect(manifest.permissions).not.toContain("offscreen")
    expect(manifest.browser_specific_settings).toMatchObject({
      gecko: {
        id: "{bd311a81-4530-4fcc-9178-74006155461b}",
      },
      gecko_android: {},
    })
  })
})
