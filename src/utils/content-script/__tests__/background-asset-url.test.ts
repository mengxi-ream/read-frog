import { Buffer } from "node:buffer"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { sendMessageMock, createObjectURLMock, revokeObjectURLMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
  createObjectURLMock: vi.fn(() => "blob:provider-logo"),
  revokeObjectURLMock: vi.fn(),
}))

vi.mock("@/utils/message", () => ({
  sendMessage: sendMessageMock,
}))

describe("resolveContentScriptAssetUrl", () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = createObjectURLMock
      static revokeObjectURL = revokeObjectURLMock
    })

    const { clearResolvedContentScriptAssetUrls } = await import("../background-asset-url")
    clearResolvedContentScriptAssetUrls()
  })

  it("proxies remote logos through backgroundFetch on page contexts", async () => {
    sendMessageMock.mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: [["content-type", "image/webp"]],
      body: Buffer.from([1, 2, 3]).toString("base64"),
      bodyEncoding: "base64",
    })

    const { resolveContentScriptAssetUrl } = await import("../background-asset-url")
    const assetUrl = await resolveContentScriptAssetUrl("https://cdn.example.com/logo.webp")

    expect(sendMessageMock).toHaveBeenCalledWith("backgroundFetch", {
      url: "https://cdn.example.com/logo.webp",
      method: "GET",
      headers: undefined,
      body: undefined,
      credentials: "omit",
      cacheConfig: undefined,
      responseType: "base64",
    })
    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    expect(assetUrl).toBe("blob:provider-logo")
  })

  it("bypasses proxying for non-remote and extension asset URLs", async () => {
    const { resolveContentScriptAssetUrl, shouldProxyAssetUrl } = await import("../background-asset-url")

    await expect(resolveContentScriptAssetUrl("data:image/svg+xml;base64,AAA")).resolves.toBe("data:image/svg+xml;base64,AAA")
    await expect(resolveContentScriptAssetUrl("moz-extension://abc/assets/provider.png")).resolves.toBe("moz-extension://abc/assets/provider.png")
    expect(shouldProxyAssetUrl("https://cdn.example.com/logo.webp", "moz-extension://abc/options.html")).toBe(false)
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  it("deduplicates concurrent requests for the same asset URL", async () => {
    let resolveFetch:
      | ((value: {
        status: number
        statusText: string
        headers: [string, string][]
        body: string
        bodyEncoding: "base64"
      }) => void)
      | undefined
    sendMessageMock.mockImplementation(() => new Promise((resolve) => {
      resolveFetch = resolve
    }))

    const { resolveContentScriptAssetUrl } = await import("../background-asset-url")
    const firstRequest = resolveContentScriptAssetUrl("https://cdn.example.com/logo.webp")
    const secondRequest = resolveContentScriptAssetUrl("https://cdn.example.com/logo.webp")

    expect(sendMessageMock).toHaveBeenCalledTimes(1)

    resolveFetch?.({
      status: 200,
      statusText: "OK",
      headers: [["content-type", "image/webp"]],
      body: Buffer.from([4, 5, 6]).toString("base64"),
      bodyEncoding: "base64",
    })

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      "blob:provider-logo",
      "blob:provider-logo",
    ])
  })

  it("returns null when background asset loading fails", async () => {
    sendMessageMock.mockRejectedValue(new Error("network error"))

    const { resolveContentScriptAssetUrl } = await import("../background-asset-url")

    await expect(resolveContentScriptAssetUrl("https://cdn.example.com/logo.webp")).resolves.toBeNull()
    expect(createObjectURLMock).not.toHaveBeenCalled()
  })
})
