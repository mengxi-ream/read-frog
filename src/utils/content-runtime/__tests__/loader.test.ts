// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://www.youtube.com/embed/abc" }
import type { Config } from "@/types/config/config"
import type { SubtitlesPlatformMode } from "@/types/config/subtitles"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config-storage-key"
import { selectPartsToRun } from "../loader"

function configWith({
  youtube = "manual",
  blacklistPatterns = [],
  whitelistPatterns,
}: {
  /** The mode of the platform the test frame (a YouTube embed) plays */
  youtube?: SubtitlesPlatformMode
  blacklistPatterns?: string[]
  /** Switches to whitelist mode */
  whitelistPatterns?: string[]
}): Config {
  return {
    ...DEFAULT_CONFIG,
    videoSubtitles: {
      ...DEFAULT_CONFIG.videoSubtitles,
      platforms: { ...DEFAULT_CONFIG.videoSubtitles.platforms, youtube },
    },
    siteControl: whitelistPatterns
      ? { mode: "whitelist", blacklistPatterns: [], whitelistPatterns }
      : { mode: "blacklist", blacklistPatterns, whitelistPatterns: [] },
  }
}

function pageAround(url: string) {
  return vi.fn<() => Promise<string | null>>(async () => url)
}

async function storeConfig(config: unknown) {
  await fakeBrowser.storage.local.set({ [CONFIG_STORAGE_KEY]: config })
}

describe("selectPartsToRun", () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it("runs nothing on a disabled site", async () => {
    await storeConfig(configWith({ blacklistPatterns: ["*.youtube.com"] }))

    expect(await selectPartsToRun(["host", "subtitles"])).toEqual([])
  })

  it("leaves subtitles out while they are off for this frame's platform", async () => {
    await storeConfig(configWith({ youtube: "off" }))

    expect(await selectPartsToRun(["host", "subtitles"])).toEqual(["host"])
  })

  it("runs subtitles while only other platforms are off", async () => {
    const config = configWith({ youtube: "auto" })
    config.videoSubtitles.platforms = {
      ...config.videoSubtitles.platforms,
      netflix: "off",
      xcom: "off",
    }
    await storeConfig(config)

    expect(await selectPartsToRun(["host", "subtitles"])).toEqual(["host", "subtitles"])
  })

  it("reads the single switch of a config stored before per-site modes", async () => {
    const { platforms: _platforms, ...videoSubtitles } = DEFAULT_CONFIG.videoSubtitles
    const stored = { ...configWith({}), videoSubtitles: { ...videoSubtitles, enabled: false } }
    await storeConfig(stored)
    expect(await selectPartsToRun(["host", "subtitles"])).toEqual(["host"])

    await storeConfig({ ...stored, videoSubtitles: { ...videoSubtitles, enabled: true } })
    expect(await selectPartsToRun(["host", "subtitles"])).toEqual(["host", "subtitles"])
  })

  it("runs nothing in a player embedded in a disabled page", async () => {
    await storeConfig(configWith({ blacklistPatterns: ["*.blog.example"] }))
    const getTopPageUrl = pageAround("https://blog.example/post")

    expect(await selectPartsToRun(["subtitles"], { getTopPageUrl })).toEqual([])
  })

  it("runs a player embedded in an enabled page", async () => {
    await storeConfig(configWith({ blacklistPatterns: ["*.other.example"] }))
    const getTopPageUrl = pageAround("https://blog.example/post")

    expect(await selectPartsToRun(["subtitles"], { getTopPageUrl })).toEqual(["subtitles"])
  })

  it("runs nothing in a player from a disabled site, in an enabled page", async () => {
    await storeConfig(configWith({ blacklistPatterns: ["*.youtube.com"] }))
    const getTopPageUrl = pageAround("https://blog.example/post")

    expect(await selectPartsToRun(["subtitles"], { getTopPageUrl })).toEqual([])
  })

  it("runs a player embedded in a page listed in whitelist mode, though its own site is not", async () => {
    // What the popup lists for the page; the player comes from youtube.com
    await storeConfig(configWith({ whitelistPatterns: ["*.blog.example"] }))
    const getTopPageUrl = pageAround("https://blog.example/post")

    expect(await selectPartsToRun(["subtitles"], { getTopPageUrl })).toEqual(["subtitles"])
  })

  it("runs nothing in a player embedded in a page not listed in whitelist mode", async () => {
    await storeConfig(configWith({ whitelistPatterns: ["*.youtube.com"] }))
    const getTopPageUrl = pageAround("https://blog.example/post")

    expect(await selectPartsToRun(["subtitles"], { getTopPageUrl })).toEqual([])
  })

  it("does not ask for the page around a frame that runs nothing anyway", async () => {
    await storeConfig(configWith({ youtube: "off" }))
    const getTopPageUrl = pageAround("https://blog.example/post")

    expect(await selectPartsToRun(["subtitles"], { getTopPageUrl })).toEqual([])
    expect(getTopPageUrl).not.toHaveBeenCalled()
  })

  it("lets the parts decide when the stored config can't", async () => {
    // Nothing stored yet
    expect(await selectPartsToRun(["host", "subtitles"])).toEqual(["host", "subtitles"])

    // Malformed: no site control to read
    await storeConfig({ videoSubtitles: { platforms: { youtube: "manual" } } })
    expect(await selectPartsToRun(["host", "subtitles"])).toEqual(["host", "subtitles"])
  })

  it("judges a player as a page of its own when the page around it can't be found out", async () => {
    const getTopPageUrl = vi.fn<() => Promise<string | null>>(async () => {
      throw new Error("Could not establish connection. Receiving end does not exist.")
    })

    await storeConfig(configWith({}))
    expect(await selectPartsToRun(["subtitles"], { getTopPageUrl })).toEqual(["subtitles"])

    await storeConfig(configWith({ whitelistPatterns: ["*.youtube.com"] }))
    expect(await selectPartsToRun(["subtitles"], { getTopPageUrl })).toEqual(["subtitles"])

    await storeConfig(configWith({ whitelistPatterns: ["*.blog.example"] }))
    expect(await selectPartsToRun(["subtitles"], { getTopPageUrl })).toEqual([])
  })
})
