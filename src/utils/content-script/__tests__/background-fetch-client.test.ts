import { Buffer } from "node:buffer"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { sendMessageMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
}))

vi.mock("@/utils/message", () => ({
  sendMessage: sendMessageMock,
}))

describe("backgroundFetch", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("reconstructs text responses through backgroundFetch", async () => {
    sendMessageMock.mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: [["content-type", "application/json"]],
      body: JSON.stringify({ ok: true }),
      bodyEncoding: "text",
    })

    const { backgroundFetch } = await import("../background-fetch-client")
    const response = await backgroundFetch("https://example.com/data.json", undefined, {
      credentials: "omit",
    })

    expect(sendMessageMock).toHaveBeenCalledWith("backgroundFetch", {
      url: "https://example.com/data.json",
      method: "GET",
      headers: undefined,
      body: undefined,
      credentials: "omit",
      cacheConfig: undefined,
      responseType: "text",
    })
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it("reconstructs binary responses from base64 payloads", async () => {
    sendMessageMock.mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: [["content-type", "image/webp"]],
      body: Buffer.from([0, 1, 2, 3]).toString("base64"),
      bodyEncoding: "base64",
    })

    const { backgroundFetch } = await import("../background-fetch-client")
    const response = await backgroundFetch("https://example.com/logo.webp", undefined, {
      credentials: "omit",
      responseType: "base64",
    })

    expect(sendMessageMock).toHaveBeenCalledWith("backgroundFetch", {
      url: "https://example.com/logo.webp",
      method: "GET",
      headers: undefined,
      body: undefined,
      credentials: "omit",
      cacheConfig: undefined,
      responseType: "base64",
    })
    expect(response.headers.get("content-type")).toBe("image/webp")
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([0, 1, 2, 3])
  })
})
