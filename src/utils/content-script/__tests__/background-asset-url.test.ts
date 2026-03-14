import { Buffer } from "node:buffer"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { sendMessageMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
}))

vi.mock("@/utils/message", () => ({
  sendMessage: sendMessageMock,
}))

describe("resolveContentScriptAssetUrl", () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    const { clearResolvedContentScriptAssetBlobs } = await import("../background-asset-url")
    clearResolvedContentScriptAssetBlobs()
  })

  it("proxies remote logos through backgroundFetch on page contexts", async () => {
    sendMessageMock.mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: [["content-type", "image/webp"]],
      body: Buffer.from([1, 2, 3]).toString("base64"),
      bodyEncoding: "base64",
    })

    const { resolveContentScriptAssetBlob } = await import("../background-asset-url")
    const assetBlob = await resolveContentScriptAssetBlob("https://cdn.example.com/logo.webp")

    expect(sendMessageMock).toHaveBeenCalledWith("backgroundFetch", {
      url: "https://cdn.example.com/logo.webp",
      method: "GET",
      headers: undefined,
      body: undefined,
      credentials: "omit",
      cacheConfig: undefined,
      responseType: "base64",
    })
    expect(assetBlob).toBeInstanceOf(Blob)
    expect(assetBlob?.type).toBe("image/webp")
    expect(Array.from(new Uint8Array(await assetBlob!.arrayBuffer()))).toEqual([1, 2, 3])
  })

  it("bypasses proxying for non-remote and extension asset URLs", async () => {
    const { resolveContentScriptAssetBlob, shouldProxyAssetUrl } = await import("../background-asset-url")

    await expect(resolveContentScriptAssetBlob("data:image/svg+xml;base64,AAA")).resolves.toBeNull()
    await expect(resolveContentScriptAssetBlob("moz-extension://abc/assets/provider.png")).resolves.toBeNull()
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

    const { resolveContentScriptAssetBlob } = await import("../background-asset-url")
    const firstRequest = resolveContentScriptAssetBlob("https://cdn.example.com/logo.webp")
    const secondRequest = resolveContentScriptAssetBlob("https://cdn.example.com/logo.webp")

    expect(sendMessageMock).toHaveBeenCalledTimes(1)

    resolveFetch?.({
      status: 200,
      statusText: "OK",
      headers: [["content-type", "image/webp"]],
      body: Buffer.from([4, 5, 6]).toString("base64"),
      bodyEncoding: "base64",
    })

    const [firstBlob, secondBlob] = await Promise.all([firstRequest, secondRequest])
    expect(firstBlob).toBeInstanceOf(Blob)
    expect(secondBlob).toBe(firstBlob)
  })

  it("returns null when background asset loading fails", async () => {
    sendMessageMock.mockRejectedValue(new Error("network error"))

    const { resolveContentScriptAssetBlob } = await import("../background-asset-url")

    await expect(resolveContentScriptAssetBlob("https://cdn.example.com/logo.webp")).resolves.toBeNull()
  })
})
