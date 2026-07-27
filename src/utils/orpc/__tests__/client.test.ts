import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const { linkOptions, sendMessageMock } = vi.hoisted(() => ({
  linkOptions: {
    fetch: undefined as typeof fetch | undefined,
  },
  sendMessageMock: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@orpc/client", () => ({
  createORPCClient: vi.fn<(link: unknown) => Record<string, never>>(() => ({})),
}))

vi.mock("@orpc/client/fetch", () => {
  const RPCLink = vi.fn<(options: { fetch: typeof fetch }) => void>(
    function captureLinkOptions(options) {
      linkOptions.fetch = options.fetch
    },
  )
  return { RPCLink }
})

vi.mock("@orpc/tanstack-query", () => ({
  createTanstackQueryUtils: vi.fn<(client: unknown) => Record<string, never>>(() => ({})),
}))

vi.mock("@/env", () => ({
  env: {
    WXT_API_URL: "https://api.example.com",
  },
}))

vi.mock("@/utils/message", () => ({
  sendMessage: sendMessageMock,
}))

describe("oRPC background fetch", () => {
  beforeAll(async () => {
    await import("../client")
  })

  beforeEach(() => {
    vi.clearAllMocks()
    sendMessageMock.mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: [["content-type", "application/json"]],
      body: JSON.stringify({ json: { ok: true } }),
    })
  })

  it("forwards Firefox request headers and body when body is null", async () => {
    const headers = new Headers({
      "content-type": "application/json",
      "x-orpc-source": "extension",
    })
    Object.defineProperty(headers, "entries", {
      value: () => {
        throw new TypeError("headers.entries() is not iterable")
      },
    })

    const text = vi.fn<() => Promise<string>>().mockResolvedValue(JSON.stringify({ json: {} }))
    const request = {
      url: "https://api.example.com/api/rpc/notebase/list",
      method: "POST",
      headers,
      body: null,
      text,
    } as unknown as Request

    await linkOptions.fetch!(request, {
      redirect: "manual",
    })

    expect(text).toHaveBeenCalledOnce()
    expect(sendMessageMock).toHaveBeenCalledWith("backgroundFetch", {
      url: "https://api.example.com/api/rpc/notebase/list",
      method: "POST",
      headers: [
        ["content-type", "application/json"],
        ["x-orpc-source", "extension"],
      ],
      body: JSON.stringify({ json: {} }),
      credentials: "include",
      redirect: "manual",
    })
  })

  it("keeps an empty request body undefined", async () => {
    const request = {
      url: "https://api.example.com/api/rpc/notebase/list",
      method: "GET",
      headers: new Headers(),
      body: null,
      text: vi.fn<() => Promise<string>>().mockResolvedValue(""),
    } as unknown as Request

    await linkOptions.fetch!(request, {})

    expect(sendMessageMock).toHaveBeenCalledWith(
      "backgroundFetch",
      expect.objectContaining({
        body: undefined,
      }),
    )
  })
})
