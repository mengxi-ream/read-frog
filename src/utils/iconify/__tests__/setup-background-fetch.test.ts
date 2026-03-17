import { beforeEach, describe, expect, it, vi } from "vitest"

const { sendMessageMock, setFetchMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
  setFetchMock: vi.fn(),
}))

vi.mock("@/utils/message", () => ({
  sendMessage: sendMessageMock,
}))

vi.mock("@iconify/react", () => ({
  _api: {
    setFetch: setFetchMock,
  },
}))

describe("ensureIconifyBackgroundFetch", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("registers the custom transport only once per runtime", async () => {
    const { ensureIconifyBackgroundFetch } = await import("../setup-background-fetch")

    ensureIconifyBackgroundFetch()
    ensureIconifyBackgroundFetch()

    expect(setFetchMock).toHaveBeenCalledTimes(1)
  })

  it("proxies Iconify requests through backgroundFetch without extension-side caching", async () => {
    sendMessageMock.mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: [["content-type", "application/json"]],
      body: JSON.stringify({ icons: { sparkles: { body: "<path />" } } }),
      bodyEncoding: "text",
    })

    const { ensureIconifyBackgroundFetch } = await import("../setup-background-fetch")
    ensureIconifyBackgroundFetch()

    const customFetch = setFetchMock.mock.calls[0][0] as typeof fetch
    const response = await customFetch("https://api.iconify.design/tabler.json?icons=sparkles")

    expect(sendMessageMock).toHaveBeenCalledWith("backgroundFetch", {
      url: "https://api.iconify.design/tabler.json?icons=sparkles",
      method: "GET",
      headers: undefined,
      body: undefined,
      credentials: "omit",
      cacheConfig: undefined,
      responseType: "text",
    })
    await expect(response.json()).resolves.toEqual({
      icons: {
        sparkles: {
          body: "<path />",
        },
      },
    })
    expect(response.status).toBe(200)
    expect(response.statusText).toBe("OK")
  })

  it("rethrows background transport failures", async () => {
    const error = new Error("network error")
    sendMessageMock.mockRejectedValue(error)

    const { ensureIconifyBackgroundFetch } = await import("../setup-background-fetch")
    ensureIconifyBackgroundFetch()

    const customFetch = setFetchMock.mock.calls[0][0] as typeof fetch

    await expect(customFetch("https://api.iconify.design/tabler.json?icons=sparkles")).rejects.toThrow("network error")
  })
})
