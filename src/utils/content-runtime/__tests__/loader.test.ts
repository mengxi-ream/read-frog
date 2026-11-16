// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://www.youtube.com/embed/abc" }
import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config-storage-key"
import { selectPartsToRun } from "../loader"

function configWith({
  subtitles = true,
  blacklistPatterns = [],
}: {
  subtitles?: boolean
  blacklistPatterns?: string[]
}): Config {
  return {
    ...DEFAULT_CONFIG,
    videoSubtitles: { ...DEFAULT_CONFIG.videoSubtitles, enabled: subtitles },
    siteControl: { ...DEFAULT_CONFIG.siteControl, mode: "blacklist", blacklistPatterns },
  }
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

  it("leaves subtitles out while they are switched off", async () => {
    await storeConfig(configWith({ subtitles: false }))

    expect(await selectPartsToRun(["host", "subtitles"])).toEqual(["host"])
  })

  it("runs nothing in a player embedded in a disabled page", async () => {
    await storeConfig(configWith({ blacklistPatterns: ["*.blog.example"] }))
    const getTopPageUrl = vi.fn<() => Promise<string | null>>(
      async () => "https://blog.example/post",
    )

    expect(await selectPartsToRun(["subtitles"], { getTopPageUrl })).toEqual([])
  })

  it("runs a player embedded in an enabled page", async () => {
    await storeConfig(configWith({ blacklistPatterns: ["*.other.example"] }))
    const getTopPageUrl = vi.fn<() => Promise<string | null>>(
      async () => "https://blog.example/post",
    )

    expect(await selectPartsToRun(["subtitles"], { getTopPageUrl })).toEqual(["subtitles"])
  })

  it("does not ask for the page around a frame that runs nothing anyway", async () => {
    await storeConfig(configWith({ subtitles: false }))
    const getTopPageUrl = vi.fn<() => Promise<string | null>>(
      async () => "https://blog.example/post",
    )

    expect(await selectPartsToRun(["subtitles"], { getTopPageUrl })).toEqual([])
    expect(getTopPageUrl).not.toHaveBeenCalled()
  })

  it("lets the parts decide when the stored config can't", async () => {
    // Nothing stored yet
    expect(await selectPartsToRun(["host", "subtitles"])).toEqual(["host", "subtitles"])

    // Malformed: no site control to read
    await storeConfig({ videoSubtitles: { enabled: true } })
    expect(await selectPartsToRun(["host", "subtitles"])).toEqual(["host", "subtitles"])
  })

  it("runs a player when the page around it can't be found out", async () => {
    await storeConfig(configWith({}))
    const getTopPageUrl = vi.fn<() => Promise<string | null>>(async () => {
      throw new Error("Could not establish connection. Receiving end does not exist.")
    })

    expect(await selectPartsToRun(["subtitles"], { getTopPageUrl })).toEqual(["subtitles"])
  })
})
