// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EDX_ACTIVE_VIDEO_ATTRIBUTE, EDX_LAST_LINE_DURATION_MS } from "@/utils/constants/subtitles"
import { NoSubtitlesError } from "@/utils/subtitles/errors"
import { edxTrackSource } from ".."

vi.mock("@/utils/i18n", () => ({ i18n: { t: (key: string) => key } }))
vi.mock("@/utils/sleep", () => ({ sleep: () => Promise.resolve() }))

const BLOCK_ID = "block-v1:HarvardX+PH559x+2T2025+type@video+block@f050"
const KEY = `${BLOCK_ID} en`
const TRANSLATION_URL =
  "/courses/course-v1:HarvardX+PH559x+2T2025/xblock/f050/handler/transcript/translation/__lang__"

function addVideoBlock(metadata: object | string, innerHTML = "") {
  const block = document.createElement("div")
  block.className = "video"
  block.dataset.blockId = BLOCK_ID
  block.dataset.metadata = typeof metadata === "string" ? metadata : JSON.stringify(metadata)
  block.setAttribute(EDX_ACTIVE_VIDEO_ATTRIBUTE, "")
  block.innerHTML = innerHTML
  document.body.append(block)
}

let transcriptResponse: () => Response
const fetchMock = vi.fn<(input: URL) => Promise<Response>>()

beforeEach(() => {
  document.body.innerHTML = ""
  addVideoBlock({ transcriptTranslationUrl: TRANSLATION_URL, transcriptLanguage: "en" })
  transcriptResponse = () =>
    Response.json({
      start: [3904, 6380],
      end: [6380, 9100],
      text: ["MIGUEL HERNAN: You probably know", "who smoke during pregnancy"],
    })
  fetchMock.mockImplementation(async () => transcriptResponse())
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("edxTrackSource", () => {
  it("keys the track by the marked video block and its language", () => {
    expect(edxTrackSource.currentKey()).toBe(KEY)
  })

  it("loads the block's transcript in its language, in milliseconds", async () => {
    await expect(edxTrackSource.load(KEY)).resolves.toEqual({
      language: "en",
      fragments: [
        { text: "MIGUEL HERNAN: You probably know", start: 3904, end: 6380 },
        { text: "who smoke during pregnancy", start: 6380, end: 9100 },
      ],
    })
    expect(fetchMock.mock.lastCall?.[0].href).toBe(
      `${window.location.origin}${TRANSLATION_URL.replace("__lang__", "en")}`,
    )
  })

  it("follows the language the learner picks in the player, as a new track", async () => {
    document.body.innerHTML = ""
    addVideoBlock(
      { transcriptTranslationUrl: TRANSLATION_URL, transcriptLanguage: "en" },
      `<ol class="langs-list menu">
        <li data-lang-code="en" class="is-active"></li>
        <li data-lang-code="zh-cn"></li>
      </ol>`,
    )
    expect(edxTrackSource.currentKey()).toBe(KEY)

    const [english, chinese] = document.querySelectorAll(".langs-list li")
    english?.classList.remove("is-active")
    chinese?.classList.add("is-active")
    const key = edxTrackSource.currentKey()
    expect(key).toBe(`${BLOCK_ID} zh-cn`)

    await expect(edxTrackSource.load(key ?? "")).resolves.toMatchObject({ language: "zh-cn" })
    expect(fetchMock.mock.lastCall?.[0].pathname).toBe(TRANSLATION_URL.replace("__lang__", "zh-cn"))
  })

  it("ends a line where the next one starts when the transcript has no end times", async () => {
    transcriptResponse = () => Response.json({ start: [0, 2000], text: ["first", "second"] })

    await expect(edxTrackSource.load(KEY)).resolves.toMatchObject({
      fragments: [
        { start: 0, end: 2000 },
        { start: 2000, end: 2000 + EDX_LAST_LINE_DURATION_MS },
      ],
    })
  })

  it("reports no subtitles when the video has no transcript in that language", async () => {
    transcriptResponse = () => new Response("Not found", { status: 404 })

    await expect(edxTrackSource.load(KEY)).rejects.toBeInstanceOf(NoSubtitlesError)
  })

  it("asks for the transcript again when edX drops the request", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))

    await expect(edxTrackSource.load(KEY)).resolves.toMatchObject({ language: "en" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("reports a load failure when the block or the transcript cannot be read", async () => {
    transcriptResponse = () => new Response("error", { status: 500 })
    await expect(edxTrackSource.load(KEY)).rejects.toThrow("subtitles.errors.trackFileNotLoaded")

    transcriptResponse = () => Response.json({ start: "nope" })
    await expect(edxTrackSource.load(KEY)).rejects.toThrow("subtitles.errors.trackFileNotLoaded")

    transcriptResponse = () => Response.json({ start: [0, 2000], text: ["only one"] })
    await expect(edxTrackSource.load(KEY)).rejects.toThrow("subtitles.errors.trackFileNotLoaded")

    transcriptResponse = () =>
      Response.json({ start: [0, 2000], end: [2000], text: ["first", "second"] })
    await expect(edxTrackSource.load(KEY)).rejects.toThrow("subtitles.errors.trackFileNotLoaded")

    await expect(edxTrackSource.load("block-v1:missing en")).rejects.toThrow(
      "subtitles.errors.trackFileNotLoaded",
    )

    document.body.innerHTML = ""
    addVideoBlock("{not json")
    expect(edxTrackSource.currentKey()).toBe(BLOCK_ID)
    await expect(edxTrackSource.load(BLOCK_ID)).rejects.toThrow(
      "subtitles.errors.trackFileNotLoaded",
    )
  })
})
