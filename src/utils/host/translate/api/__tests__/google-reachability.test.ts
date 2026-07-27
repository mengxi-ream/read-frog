import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isGoogleTranslateReachable } from "../google"

const fetchMock = vi.fn<(...args: any[]) => any>()

function okResponse(translated: string) {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: "OK",
    json: vi.fn<(...args: any[]) => any>().mockResolvedValue([[translated]]),
    text: vi.fn<(...args: any[]) => any>().mockResolvedValue(""),
  })
}

describe("isGoogleTranslateReachable", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("reports reachable when the endpoint returns a translation", async () => {
    fetchMock.mockImplementation(() => okResponse("你好"))

    await expect(isGoogleTranslateReachable()).resolves.toBe(true)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("translate-pa.googleapis.com")
  })

  it("reports unreachable when the request fails at the network layer", async () => {
    fetchMock.mockRejectedValue(new Error("Failed to fetch"))

    await expect(isGoogleTranslateReachable()).resolves.toBe(false)
  })

  it("reports unreachable when the endpoint answers with an error status", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: vi.fn<(...args: any[]) => any>().mockResolvedValue("blocked"),
    })

    await expect(isGoogleTranslateReachable()).resolves.toBe(false)
  })

  it("reports unreachable when the request hangs past the timeout", async () => {
    // The blocked-network case: no response, no error, just silence until we give up.
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new Error("The operation was aborted")),
          )
        }),
    )

    await expect(isGoogleTranslateReachable({ timeoutMs: 10 })).resolves.toBe(false)
  })

  it("reports unreachable when the response shape is not a translation", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: vi.fn<(...args: any[]) => any>().mockResolvedValue({ error: "unexpected" }),
        text: vi.fn<(...args: any[]) => any>().mockResolvedValue(""),
      }),
    )

    await expect(isGoogleTranslateReachable()).resolves.toBe(false)
  })
})
