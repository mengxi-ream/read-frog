import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clearEdgeTTSTokenCache, getEdgeTTSEndpointToken } from "../endpoint"
import * as signatureModule from "../signature"

function toBase64Url(obj: unknown): string {
  const json = JSON.stringify(obj)
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function createJwt(expSeconds: number): string {
  return `${toBase64Url({ alg: "HS256", typ: "JWT" })}.${toBase64Url({ exp: expSeconds })}.signature`
}

describe("getEdgeTTSEndpointToken", () => {
  beforeEach(() => {
    clearEdgeTTSTokenCache()
    vi.spyOn(signatureModule, "generateTranslatorSignature").mockResolvedValue("mock-signature")
  })

  afterEach(() => {
    clearEdgeTTSTokenCache()
    vi.restoreAllMocks()
  })

  it("caches endpoint token until refresh threshold", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        r: "eastus",
        t: createJwt(Math.floor(Date.now() / 1000) + 600),
      }), {
        status: 200,
      }),
    )

    const first = await getEdgeTTSEndpointToken()
    const second = await getEdgeTTSEndpointToken()

    expect(first.token).toBe(second.token)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("falls back to cached token when refresh request fails but token is still unexpired", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({
        r: "eastus",
        t: createJwt(nowSeconds + 60),
      }), {
        status: 200,
      }),
    )

    fetchSpy.mockRejectedValueOnce(new TypeError("network down"))

    const first = await getEdgeTTSEndpointToken()
    const second = await getEdgeTTSEndpointToken()

    expect(first.token).toBe(second.token)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("throws when refresh request fails and cached token is expired", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({
        r: "eastus",
        t: createJwt(nowSeconds - 10),
      }), {
        status: 200,
      }),
    )

    fetchSpy.mockRejectedValueOnce(new TypeError("network down"))

    await getEdgeTTSEndpointToken()

    await expect(getEdgeTTSEndpointToken()).rejects.toMatchObject({
      code: "TOKEN_FETCH_FAILED",
    })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
