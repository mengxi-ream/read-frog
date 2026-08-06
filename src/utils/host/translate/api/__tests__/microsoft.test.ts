import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getRequestErrorMeta } from "@/utils/request/retry-policy"
import { microsoftTranslate } from "../microsoft"

const fetchMock = vi.fn<(...args: any[]) => any>()
let responseBody: unknown = [{ translations: [{ text: "你好" }] }]

function okResponse() {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: vi.fn<(...args: any[]) => any>().mockImplementation(async () => responseBody),
    text: vi.fn<(...args: any[]) => any>().mockResolvedValue(""),
  }
}

function requestURL(): string {
  expect(fetchMock).toHaveBeenCalledTimes(1)
  return String(fetchMock.mock.calls[0]![0])
}

function requestBody(): unknown {
  expect(fetchMock).toHaveBeenCalledTimes(1)
  return JSON.parse(fetchMock.mock.calls[0]![1].body)
}

describe("microsoft translate adapter", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    responseBody = [{ translations: [{ text: "你好" }] }]
    fetchMock.mockImplementation(() => Promise.resolve(okResponse()))
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("posts a bare string array to the unauthenticated translatetext endpoint", async () => {
    const result = await microsoftTranslate("hello", "en", "zh")

    expect(result).toBe("你好")
    expect(requestURL()).toBe(
      "https://edge.microsoft.com/translate/translatetext?from=en&to=zh&isEnterpriseClient=false",
    )
    expect(requestBody()).toEqual(["hello"])
    expect(fetchMock.mock.calls[0]![1].headers).toEqual({ "Content-Type": "application/json" })
  })

  it("sends an empty from parameter for auto source detection", async () => {
    await microsoftTranslate("hello", "auto", "zh")

    expect(requestURL()).toBe(
      "https://edge.microsoft.com/translate/translatetext?from=&to=zh&isEnterpriseClient=false",
    )
  })

  it("escapes markup-significant characters so the endpoint's tag aligner cannot eat them", async () => {
    await microsoftTranslate("Compare a < b and c > d & more", "en", "zh")

    expect(requestBody()).toEqual(["Compare a &lt; b and c &gt; d &amp; more"])
  })

  it("translates array input in order", async () => {
    responseBody = [{ translations: [{ text: "你好" }] }, { translations: [{ text: "早上好" }] }]

    const result = await microsoftTranslate(["hello", "good morning"], "en", "zh")

    expect(result).toEqual(["你好", "早上好"])
    expect(requestBody()).toEqual(["hello", "good morning"])
  })

  it("returns an empty array for empty input without fetching", async () => {
    const result = await microsoftTranslate([], "en", "zh")

    expect(result).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects html format input instead of corrupting markup", async () => {
    await expect(
      microsoftTranslate('<a data-rf-attr="0">pricing</a>', "en", "zh", { textFormat: "html" }),
    ).rejects.toThrow(/does not support HTML/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("marks network failures as retryable", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("boom")))

    const error = await microsoftTranslate("hello", "en", "zh").catch((e: Error) => e)

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain("Network error during Microsoft translation")
    expect(getRequestErrorMeta(error)).toMatchObject({ kind: "network", isRetryable: true })
  })

  it("attaches status metadata to non-2xx responses", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: new Headers({ "retry-after": "3" }),
        text: vi.fn<(...args: any[]) => any>().mockResolvedValue("slow down"),
      }),
    )

    const error = await microsoftTranslate("hello", "en", "zh").catch((e: Error) => e)

    expect((error as Error).message).toContain("429")
    expect((error as Error).message).toContain("slow down")
    expect(getRequestErrorMeta(error)).toMatchObject({ statusCode: 429 })
  })

  it("passes the abort signal through to fetch", async () => {
    const controller = new AbortController()

    await microsoftTranslate("hello", "en", "zh", { signal: controller.signal })

    expect(fetchMock.mock.calls[0]![1].signal).toBe(controller.signal)
  })

  it("rejects responses whose length does not match the request", async () => {
    responseBody = []

    await expect(microsoftTranslate("hello", "en", "zh")).rejects.toThrow(
      /expected 1 results, got 0/,
    )
  })

  it("rejects items with a missing translation", async () => {
    responseBody = [{ translations: [] }]

    await expect(microsoftTranslate("hello", "en", "zh")).rejects.toThrow(
      /Missing translation for item at index 0/,
    )
  })
})
