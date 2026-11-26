// @vitest-environment jsdom

import type { BilibiliSubtitlesResponse } from ".."
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import { NoSubtitlesError } from "@/utils/subtitles/errors"
import { bilibiliTrackSource, watchBilibiliTrackChoices } from ".."

vi.mock("@/utils/i18n", () => ({ i18n: { t: (key: string) => key } }))
vi.mock("@/utils/sleep", () => ({ sleep: () => Promise.resolve() }))
const readerLanguage = vi.hoisted(() => ({ sourceCode: "auto", targetCode: "zh-Hans" }))
vi.mock("@/utils/config/storage", () => ({
  getLocalConfig: () => Promise.resolve({ language: { ...readerLanguage } }),
}))

const postMessageRequest = vi.fn<(...args: unknown[]) => Promise<unknown>>()
vi.mock("@/utils/subtitles/fetchers/post-message-request", () => ({
  postMessageRequest: (...args: unknown[]) => postMessageRequest(...args),
}))

const HUMAN = { lan: "zh-CN", subtitle_url: "//i0.hdslb.com/bfs/subtitle/zh.json" }
const AI = { lan: "ai-zh", subtitle_url: "//aisubtitle.hdslb.com/bfs/ai_subtitle/zh.json" }
const FILE = {
  body: [
    { from: 3.12, to: 4.34, content: "在我的印象中", music: 0 },
    { from: 0.22, to: 3.12, content: " 这就是刚刚发布的手机 " },
  ],
}

function response(overrides: Partial<BilibiliSubtitlesResponse> = {}): BilibiliSubtitlesResponse {
  return {
    type: "response",
    requestId: "1",
    cid: 42,
    subtitles: [AI, HUMAN],
    ...overrides,
  }
}

const PART_ID = "BV1XZn26rE8x:2"
const fetchMock = vi.fn<typeof fetch>()

let stopListening: () => void

beforeEach(() => {
  readerLanguage.sourceCode = "auto"
  readerLanguage.targetCode = "zh-Hans"
  stopListening = watchBilibiliTrackChoices()
  window.history.replaceState(null, "", "/video/BV1XZn26rE8x/?p=2")
  postMessageRequest.mockResolvedValue(response())
  fetchMock.mockResolvedValue(Response.json(FILE))
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  stopListening()
  document.body.innerHTML = ""
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// As Bilibili's subtitle menu marks the track its player shows, whoever chose it.
function showSelectedInPlayer(lan: string) {
  document.body.innerHTML = `
    <div class="bpx-player-ctrl-subtitle-close-switch"></div>
    <div class="bpx-player-ctrl-subtitle-language-item bpx-state-active" data-lan="${lan}">
      <span class="bpx-player-ctrl-subtitle-language-item-text"></span>
    </div>`
}

function pickInPlayer(lan: string) {
  showSelectedInPlayer(lan)
  document
    .querySelector(".bpx-player-ctrl-subtitle-language-item-text")!
    .dispatchEvent(new MouseEvent("click", { bubbles: true }))
}

describe("bilibiliTrackSource", () => {
  it("keys the track by the video part in the url and the reader's pick in the player", () => {
    expect(bilibiliTrackSource.currentKey()).toBe("BV1XZn26rE8x:2##0")
    pickInPlayer("ai-en")
    expect(bilibiliTrackSource.currentKey()).toBe("BV1XZn26rE8x:2#ai-en#0")
  })

  it("picks again once the reader's source or target language changes", async () => {
    const before = bilibiliTrackSource.currentKey()
    await storage.setItem(`local:${CONFIG_STORAGE_KEY}`, {
      language: { sourceCode: "ja", targetCode: "zh-Hans" },
    })

    await vi.waitFor(() => expect(bilibiliTrackSource.currentKey()).not.toBe(before))
  })

  it("forgets the pick once subtitles are turned off in the player", () => {
    pickInPlayer("ai-en")
    document
      .querySelector(".bpx-player-ctrl-subtitle-close-switch")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }))
    expect(bilibiliTrackSource.currentKey()).toBe("BV1XZn26rE8x:2##0")
  })

  it("asks the page for the part and loads the uploader's subtitles, in milliseconds", async () => {
    await expect(bilibiliTrackSource.load(PART_ID)).resolves.toEqual({
      language: "zh-CN",
      fragments: [
        { text: "在我的印象中", start: 3120, end: 4340 },
        { text: " 这就是刚刚发布的手机 ", start: 220, end: 3120 },
      ],
    })
    expect(postMessageRequest.mock.lastCall?.[1]).toMatchObject({ partId: PART_ID })
    expect(fetchMock.mock.lastCall?.[0]).toEqual(
      new URL("https://i0.hdslb.com/bfs/subtitle/zh.json"),
    )
  })

  it("falls back to AI subtitles, skipping entries it cannot read", async () => {
    postMessageRequest.mockResolvedValue(response({ subtitles: [{ lan: 1 }, AI] }))

    await expect(bilibiliTrackSource.load(PART_ID)).resolves.toMatchObject({ language: "zh" })
  })

  function aiTrack(lan: string, aiType: number) {
    return { lan, subtitle_url: `//aisubtitle.hdslb.com/${lan}.json`, ai_type: aiType }
  }

  it("takes the AI transcript, not the Chinese translation Bilibili lists first", async () => {
    postMessageRequest.mockResolvedValue(
      response({ subtitles: [aiTrack("ai-zh", 1), aiTrack("ai-ja", 1), aiTrack("ai-en", 0)] }),
    )

    await expect(bilibiliTrackSource.load(PART_ID)).resolves.toMatchObject({ language: "en" })
  })

  const TRANSLATIONS_ONLY = [aiTrack("ai-zh", 1), aiTrack("ai-ja", 1), aiTrack("ai-en", 1)]

  it("takes the track picked in the player first, even over the uploader's", async () => {
    pickInPlayer("ai-en")
    postMessageRequest.mockResolvedValue(response({ subtitles: [HUMAN, aiTrack("ai-en", 1)] }))

    await expect(
      bilibiliTrackSource.load(bilibiliTrackSource.currentKey()!),
    ).resolves.toMatchObject({ language: "en" })
    expect(postMessageRequest.mock.lastCall?.[1]).toMatchObject({ partId: PART_ID })
  })

  it("ignores the track Bilibili selected on its own, whatever the reader's language", async () => {
    readerLanguage.targetCode = "es"
    showSelectedInPlayer("ai-zh")
    postMessageRequest.mockResolvedValue(
      response({ subtitles: [aiTrack("ai-zh", 1), aiTrack("ai-en", 0)] }),
    )

    await expect(
      bilibiliTrackSource.load(bilibiliTrackSource.currentKey()!),
    ).resolves.toMatchObject({ language: "en" })
  })

  it("without a transcript, takes the reader's source language", async () => {
    readerLanguage.sourceCode = "ja"
    postMessageRequest.mockResolvedValue(
      response({ subtitles: [aiTrack("ai-zh", 1), aiTrack("ai-en", 1), aiTrack("ai-ja", 1)] }),
    )

    await expect(bilibiliTrackSource.load(PART_ID)).resolves.toMatchObject({ language: "ja" })
  })

  it("without a transcript or a source language, takes the first track not in the reader's language", async () => {
    postMessageRequest.mockResolvedValue(response({ subtitles: TRANSLATIONS_ONLY }))

    await expect(bilibiliTrackSource.load(PART_ID)).resolves.toMatchObject({ language: "ja" })
  })

  it("without a track in the source language, falls back the same way", async () => {
    readerLanguage.sourceCode = "fr"
    postMessageRequest.mockResolvedValue(response({ subtitles: TRANSLATIONS_ONLY }))

    await expect(bilibiliTrackSource.load(PART_ID)).resolves.toMatchObject({ language: "ja" })
  })

  it("reports no subtitles when the list is empty, as it is for a signed-out viewer", async () => {
    postMessageRequest.mockResolvedValue(response({ subtitles: [] }))

    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toBeInstanceOf(NoSubtitlesError)
  })

  it("reports a timeout when the page never names the part", async () => {
    postMessageRequest.mockResolvedValue(response({ cid: null, subtitles: null }))
    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.fetchSubTimeout",
    )

    postMessageRequest.mockResolvedValue(null)
    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.fetchSubTimeout",
    )
  })

  it("asks for the file again when the subtitle host drops the request", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))

    await expect(bilibiliTrackSource.load(PART_ID)).resolves.toMatchObject({ language: "zh-CN" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("reports a load failure when the list or the file cannot be had", async () => {
    postMessageRequest.mockResolvedValue(response({ subtitles: null }))
    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.trackFileNotLoaded",
    )

    postMessageRequest.mockResolvedValue(response())
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }))
    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.trackFileNotLoaded",
    )

    fetchMock.mockResolvedValue(Response.json({ body: "not a list" }))
    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.trackFileNotLoaded",
    )

    fetchMock.mockRejectedValue(new TypeError("network"))
    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.trackFileNotLoaded",
    )
  })
})
