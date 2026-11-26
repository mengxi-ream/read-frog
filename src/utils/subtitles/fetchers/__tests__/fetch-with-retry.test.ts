import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TRACK_FETCH_ATTEMPTS, TRACK_FETCH_RETRY_DELAY_MS } from "@/utils/constants/subtitles"
import { fetchWithRetry } from "../fetch-with-retry"

const sleep = vi.fn<(ms: number) => Promise<void>>()
vi.mock("@/utils/sleep", () => ({ sleep: (ms: number) => sleep(ms) }))

const TRACK_URL = "https://subtitles.example/track.json"
const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  sleep.mockResolvedValue(undefined)
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("fetchWithRetry", () => {
  it("returns the first response the host gives", async () => {
    const ok = new Response("{}")
    fetchMock.mockResolvedValue(ok)

    await expect(fetchWithRetry(TRACK_URL)).resolves.toBe(ok)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(sleep).not.toHaveBeenCalled()
  })

  it("asks again after a request that failed outright or a server error", async () => {
    const ok = new Response("{}")
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("", { status: 502 }))
      .mockResolvedValueOnce(ok)

    await expect(fetchWithRetry(TRACK_URL)).resolves.toBe(ok)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledWith(TRACK_FETCH_RETRY_DELAY_MS)
  })

  it("takes the host's answer when it says the file is not there", async () => {
    const missing = new Response("", { status: 404 })
    fetchMock.mockResolvedValue(missing)

    await expect(fetchWithRetry(TRACK_URL)).resolves.toBe(missing)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it("gives up after its attempts", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))
    await expect(fetchWithRetry(TRACK_URL)).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(TRACK_FETCH_ATTEMPTS)

    fetchMock.mockClear()
    const unavailable = new Response("", { status: 503 })
    fetchMock.mockResolvedValue(unavailable)
    await expect(fetchWithRetry(TRACK_URL)).resolves.toBe(unavailable)
    expect(fetchMock).toHaveBeenCalledTimes(TRACK_FETCH_ATTEMPTS)
  })
})
