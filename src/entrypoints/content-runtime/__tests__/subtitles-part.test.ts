// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://www.bilibili.com/video/BV1bx476YEGe/" }
import type { ContentScriptContext } from "#imports"
import type { Config } from "@/types/config/config"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { sitePatternForHost } from "@/utils/url-pattern"
import { runSubtitlesContent } from "../subtitles/main"

const mocks = vi.hoisted(() => ({
  getLocalConfig: vi.fn<() => Promise<Config | null>>(),
  bootstrapSubtitlesRuntime: vi.fn<(ctx: ContentScriptContext) => void>(),
  getTopPageUrl: vi.fn<() => Promise<string | null>>(),
}))

vi.mock("@/utils/config/storage", () => ({ getLocalConfig: mocks.getLocalConfig }))
vi.mock("@/utils/content-runtime/top-page-url", () => ({ getTopPageUrl: mocks.getTopPageUrl }))
vi.mock("@/utils/i18n", () => ({ initI18n: vi.fn<() => Promise<void>>() }))
vi.mock("@/entrypoints/subtitles.content/runtime", () => ({
  bootstrapSubtitlesRuntime: mocks.bootstrapSubtitlesRuntime,
}))

// What the popup's "Disable on this site" adds for the page it is on
const THIS_SITE = sitePatternForHost(window.location.hostname)

function configWith(
  siteControl: Partial<Config["siteControl"]>,
  { subtitles = true }: { subtitles?: boolean } = {},
): Config {
  return {
    ...DEFAULT_CONFIG,
    videoSubtitles: {
      ...DEFAULT_CONFIG.videoSubtitles,
      platforms: {
        ...DEFAULT_CONFIG.videoSubtitles.platforms,
        bilibili: subtitles ? "manual" : "off",
      },
    },
    siteControl: { ...DEFAULT_CONFIG.siteControl, ...siteControl },
  }
}

async function runPart(config: Config) {
  mocks.getLocalConfig.mockResolvedValue(config)
  const ctx = { onInvalidated: vi.fn<() => void>() } as unknown as ContentScriptContext
  await runSubtitlesContent(ctx)
}

describe("the subtitles part", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete window.__READ_FROG_SUBTITLES_INJECTED__
    // The top frame, unless a test embeds the player
    mocks.getTopPageUrl.mockResolvedValue(window.location.href)
  })

  it("starts subtitles on a site that is not disabled", async () => {
    await runPart(configWith({ mode: "blacklist", blacklistPatterns: ["*.example.com"] }))

    expect(mocks.bootstrapSubtitlesRuntime).toHaveBeenCalledTimes(1)
    expect(window.__READ_FROG_SUBTITLES_INJECTED__).toBe(true)
  })

  it("does not start subtitles on a site disabled from the popup", async () => {
    await runPart(configWith({ mode: "blacklist", blacklistPatterns: [THIS_SITE] }))

    expect(mocks.bootstrapSubtitlesRuntime).not.toHaveBeenCalled()
    expect(window.__READ_FROG_SUBTITLES_INJECTED__).toBe(false)
  })

  it("does not start subtitles in whitelist mode on a site not in the list", async () => {
    await runPart(configWith({ mode: "whitelist", whitelistPatterns: ["*.example.com"] }))

    expect(mocks.bootstrapSubtitlesRuntime).not.toHaveBeenCalled()
    expect(window.__READ_FROG_SUBTITLES_INJECTED__).toBe(false)
  })

  it("starts subtitles in whitelist mode on a site in the list", async () => {
    await runPart(configWith({ mode: "whitelist", whitelistPatterns: [THIS_SITE] }))

    expect(mocks.bootstrapSubtitlesRuntime).toHaveBeenCalledTimes(1)
  })

  it("does not start subtitles while they are off for Bilibili", async () => {
    await runPart(configWith({}, { subtitles: false }))

    expect(mocks.bootstrapSubtitlesRuntime).not.toHaveBeenCalled()
    expect(window.__READ_FROG_SUBTITLES_INJECTED__).toBe(false)
  })

  it("starts subtitles on Bilibili while another platform is off", async () => {
    const config = configWith({})
    config.videoSubtitles.platforms = { ...config.videoSubtitles.platforms, youtube: "off" }
    await runPart(config)

    expect(mocks.bootstrapSubtitlesRuntime).toHaveBeenCalledTimes(1)
  })

  describe("in a player embedded in another site's page", () => {
    beforeEach(() => {
      mocks.getTopPageUrl.mockResolvedValue("https://blog.example/post")
    })

    it("starts subtitles when whitelist mode lists the page, though not the player's site", async () => {
      await runPart(configWith({ mode: "whitelist", whitelistPatterns: ["*.blog.example"] }))

      expect(mocks.bootstrapSubtitlesRuntime).toHaveBeenCalledTimes(1)
    })

    it("does not start subtitles when whitelist mode lists the player's site only", async () => {
      await runPart(configWith({ mode: "whitelist", whitelistPatterns: [THIS_SITE] }))

      expect(mocks.bootstrapSubtitlesRuntime).not.toHaveBeenCalled()
      expect(window.__READ_FROG_SUBTITLES_INJECTED__).toBe(false)
    })

    it("does not start subtitles in a page disabled from the popup", async () => {
      await runPart(configWith({ mode: "blacklist", blacklistPatterns: ["*.blog.example"] }))

      expect(mocks.bootstrapSubtitlesRuntime).not.toHaveBeenCalled()
    })

    it("does not start subtitles from a video site disabled from the popup", async () => {
      await runPart(configWith({ mode: "blacklist", blacklistPatterns: [THIS_SITE] }))

      expect(mocks.bootstrapSubtitlesRuntime).not.toHaveBeenCalled()
    })

    it("judges the player as a page of its own when the page can't be found out", async () => {
      mocks.getTopPageUrl.mockResolvedValue(null)
      await runPart(configWith({ mode: "whitelist", whitelistPatterns: [THIS_SITE] }))

      expect(mocks.bootstrapSubtitlesRuntime).toHaveBeenCalledTimes(1)
    })
  })
})
