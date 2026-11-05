// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NoSubtitlesError } from "@/utils/subtitles/errors"
import { udemyTrackSource } from ".."

vi.mock("@/utils/i18n", () => ({ i18n: { t: (key: string) => key } }))
vi.mock("@/utils/sleep", () => ({ sleep: () => Promise.resolve() }))

const VTT = "WEBVTT\r\nKind: captions\r\n\r\n00:00:01.980 --> 00:00:06.320\r\nIn this lecture\r\n"

function caption(locale_id: string, source: "manual" | "auto", status = 1) {
  return {
    locale_id,
    source,
    status,
    url: `https://vtt-c.udemycdn.com/1/${locale_id}/${source}.vtt`,
  }
}

let course: unknown
let lecture: unknown
let vttResponse: () => Response
const fetchMock = vi.fn<(input: string | URL) => Promise<Response>>()
const hrefOf = (input: string | URL) => new URL(input, window.location.origin).href
let slugCount = 0
let slug = ""

beforeEach(() => {
  // Each test gets its own course, so the per-slug cache never carries over.
  slug = `course-${++slugCount}`
  window.history.replaceState(null, "", `/course/${slug}/learn/lecture/7`)
  course = { id: 42, locale: { locale: "en_IN" } }
  lecture = { asset: { captions: [caption("es_ES", "manual"), caption("en_IN", "manual")] } }
  vttResponse = () => new Response(VTT)
  fetchMock.mockImplementation(async (input) => {
    const { pathname } = new URL(hrefOf(input))
    if (pathname === `/api-2.0/courses/${slug}/`) return Response.json(course)
    if (pathname === "/api-2.0/users/me/subscribed-courses/42/lectures/7/") {
      return Response.json(lecture)
    }
    return vttResponse()
  })
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function load() {
  return udemyTrackSource.load(`${slug}/7`)
}

function downloadedCaption(): string | undefined {
  return fetchMock.mock.calls
    .map(([input]) => hrefOf(input))
    .find((href) => href.startsWith("https://vtt-c.udemycdn.com/"))
}

describe("udemyTrackSource", () => {
  it("keys the track by the course and lecture in the url", () => {
    expect(udemyTrackSource.currentKey()).toBe(`${slug}/7`)
  })

  it("loads the uploaded caption in the course's own language", async () => {
    await expect(load()).resolves.toEqual({
      language: "en-IN",
      fragments: [{ text: "In this lecture", start: 1980, end: 6320 }],
    })
    expect(downloadedCaption()).toBe("https://vtt-c.udemycdn.com/1/en_IN/manual.vtt")
  })

  it("reads a file that starts with a byte order mark", async () => {
    vttResponse = () => new Response(String.fromCharCode(0xfeff) + VTT)

    await expect(load()).resolves.toMatchObject({ fragments: [{ text: "In this lecture" }] })
  })

  it("takes the automatic caption in the course's language over an uploaded translation", async () => {
    lecture = { asset: { captions: [caption("es_ES", "manual"), caption("en_US", "auto")] } }

    await expect(load()).resolves.toMatchObject({ language: "en-US" })
  })

  it("falls back to an uploaded caption, then to any, when none is in the course's language", async () => {
    lecture = { asset: { captions: [caption("ar_SA", "auto"), caption("es_ES", "manual")] } }
    await expect(load()).resolves.toMatchObject({ language: "es-ES" })

    lecture = { asset: { captions: [caption("ar_SA", "auto")] } }
    await expect(load()).resolves.toMatchObject({ language: "ar-SA" })
  })

  it("skips captions Udemy has not finished", async () => {
    lecture = { asset: { captions: [caption("en_IN", "manual", 0), caption("en_IN", "auto")] } }

    await expect(load()).resolves.toMatchObject({ language: "en-IN" })
    expect(downloadedCaption()).toBe("https://vtt-c.udemycdn.com/1/en_IN/auto.vtt")
  })

  it("reads a caption whose language comes as a locale code or a locale object", async () => {
    const { locale_id: _english, ...english } = caption("en_IN", "manual")
    const { locale_id: _spanish, ...spanish } = caption("es_ES", "manual")
    lecture = {
      asset: {
        captions: [
          { ...spanish, locale: "es_ES" },
          { ...english, locale: { locale: "en_IN" } },
        ],
      },
    }

    await expect(load()).resolves.toMatchObject({ language: "en-IN" })
    expect(downloadedCaption()).toBe("https://vtt-c.udemycdn.com/1/en_IN/manual.vtt")
  })

  it("asks for the course once per page", async () => {
    await load()
    await load()

    const courseCalls = fetchMock.mock.calls.filter(([input]) =>
      hrefOf(input).startsWith(`${window.location.origin}/api-2.0/courses/${slug}/`),
    )
    expect(courseCalls).toHaveLength(1)
  })

  it("reports no subtitles when the lecture has none", async () => {
    lecture = { asset: { captions: [] } }

    await expect(load()).rejects.toBeInstanceOf(NoSubtitlesError)
  })

  it("asks again when Udemy drops a request", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))

    await expect(load()).resolves.toMatchObject({ language: "en-IN" })
    // The course twice, then the lecture and its caption file.
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it("reports a load failure when the course, the lecture or the file cannot be had", async () => {
    course = { detail: "Not found." }
    await expect(load()).rejects.toThrow("subtitles.errors.trackFileNotLoaded")

    course = { id: 42, locale: { locale: "en_IN" } }
    lecture = { detail: "You do not have permission to perform this action." }
    await expect(load()).rejects.toThrow("subtitles.errors.trackFileNotLoaded")

    lecture = { asset: { captions: [caption("en_IN", "manual")] } }
    vttResponse = () => new Response("forbidden", { status: 403 })
    await expect(load()).rejects.toThrow("subtitles.errors.trackFileNotLoaded")

    vttResponse = () => new Response("<html>Sign in</html>")
    await expect(load()).rejects.toThrow("subtitles.errors.trackFileNotLoaded")
  })
})
