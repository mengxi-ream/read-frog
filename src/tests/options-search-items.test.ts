import { afterEach, describe, expect, it, vi } from "vitest"

async function loadSearchItems(
  browser: string,
  wxtFirefoxAndroid?: string,
) {
  vi.resetModules()
  vi.unstubAllEnvs()
  vi.stubEnv("BROWSER", browser)

  if (wxtFirefoxAndroid !== undefined) {
    vi.stubEnv("WXT_FIREFOX_ANDROID", wxtFirefoxAndroid)
  }

  return import("@/entrypoints/options/command-palette/search-items")
}

describe("search item visibility", () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it("hides Android-unsupported entries in the Firefox Android build", async () => {
    const { SEARCH_ITEMS } = await loadSearchItems("firefox", "true")
    const sectionIds = SEARCH_ITEMS.map(item => item.sectionId)

    expect(sectionIds).not.toContain("google-drive-sync")
    expect(sectionIds).not.toContain("context-menu-translate")
  })

  it("keeps desktop Firefox entries available", async () => {
    const { SEARCH_ITEMS } = await loadSearchItems("firefox")
    const sectionIds = SEARCH_ITEMS.map(item => item.sectionId)

    expect(sectionIds).toContain("google-drive-sync")
    expect(sectionIds).toContain("context-menu-translate")
  })
})
