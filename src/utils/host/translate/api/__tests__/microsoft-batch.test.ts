import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe("microsoftTranslateBatch", () => {
  it("sends a single batched request and returns results in order", async () => {
    const fetchMock = vi.fn(async (url: any, init?: any) => {
      if (url === "https://edge.microsoft.com/translate/auth") {
        return new Response("test-token", { status: 200 })
      }

      if (typeof url === "string" && url.startsWith("https://api-edge.cognitive.microsofttranslator.com/translate?")) {
        expect(init?.method).toBe("POST")
        expect(init?.headers?.Authorization).toBe("Bearer test-token")

        const body = JSON.parse(init?.body as string)
        expect(body).toEqual([{ Text: "Hello" }, { Text: "World" }])

        return new Response(JSON.stringify([
          { translations: [{ text: "hello-zh" }] },
          { translations: [{ text: "world-zh" }] },
        ]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      throw new Error(`Unexpected fetch: ${String(url)}`)
    })

    vi.stubGlobal("fetch", fetchMock as any)

    const { microsoftTranslateBatch } = await import("../../api/microsoft")

    await expect(
      microsoftTranslateBatch(["Hello", "World"], "en", "zh"),
    ).resolves.toEqual(["hello-zh", "world-zh"])

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("reuses the auth token across calls", async () => {
    let authCalls = 0
    let translateCalls = 0

    const fetchMock = vi.fn(async (url: any) => {
      if (url === "https://edge.microsoft.com/translate/auth") {
        authCalls++
        return new Response("cached-token", { status: 200 })
      }

      if (typeof url === "string" && url.startsWith("https://api-edge.cognitive.microsofttranslator.com/translate?")) {
        translateCalls++
        return new Response(JSON.stringify([
          { translations: [{ text: `t${translateCalls}` }] },
        ]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      throw new Error(`Unexpected fetch: ${String(url)}`)
    })

    vi.stubGlobal("fetch", fetchMock as any)

    const { microsoftTranslate } = await import("../../api/microsoft")

    await expect(microsoftTranslate("a", "en", "zh")).resolves.toBe("t1")
    await expect(microsoftTranslate("b", "en", "zh")).resolves.toBe("t2")

    expect(authCalls).toBe(1)
    expect(translateCalls).toBe(2)
  })

  it("refreshes the auth token and retries once on 401/403", async () => {
    let authCalls = 0
    let translateCalls = 0

    const fetchMock = vi.fn(async (url: any, init?: any) => {
      if (url === "https://edge.microsoft.com/translate/auth") {
        authCalls++
        return new Response(authCalls === 1 ? "token-1" : "token-2", { status: 200 })
      }

      if (typeof url === "string" && url.startsWith("https://api-edge.cognitive.microsofttranslator.com/translate?")) {
        translateCalls++

        const authHeader = init?.headers?.Authorization
        if (translateCalls === 1) {
          expect(authHeader).toBe("Bearer token-1")
          return new Response("Unauthorized", { status: 401, statusText: "Unauthorized" })
        }

        expect(authHeader).toBe("Bearer token-2")
        return new Response(JSON.stringify([
          { translations: [{ text: "ok" }] },
        ]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      throw new Error(`Unexpected fetch: ${String(url)}`)
    })

    vi.stubGlobal("fetch", fetchMock as any)

    const { microsoftTranslate } = await import("../../api/microsoft")

    await expect(microsoftTranslate("a", "en", "zh")).resolves.toBe("ok")

    expect(authCalls).toBe(2)
    expect(translateCalls).toBe(2)
  })

  it("deduplicates concurrent token refresh requests", async () => {
    let authCalls = 0
    let translateCalls = 0

    let resolveAuth!: (response: Response) => void
    const authPromise = new Promise<Response>((resolve) => {
      resolveAuth = resolve
    })

    const fetchMock = vi.fn(async (url: any, init?: any) => {
      if (url === "https://edge.microsoft.com/translate/auth") {
        authCalls++
        return authPromise
      }

      if (typeof url === "string" && url.startsWith("https://api-edge.cognitive.microsofttranslator.com/translate?")) {
        translateCalls++
        const body = JSON.parse(init?.body as string)
        const sourceText = body?.[0]?.Text as string
        return new Response(JSON.stringify([
          { translations: [{ text: `translated:${sourceText}` }] },
        ]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      throw new Error(`Unexpected fetch: ${String(url)}`)
    })

    vi.stubGlobal("fetch", fetchMock as any)

    const { microsoftTranslate } = await import("../../api/microsoft")

    const p1 = microsoftTranslate("first", "en", "zh")
    const p2 = microsoftTranslate("second", "en", "zh")

    expect(authCalls).toBe(1)

    resolveAuth(new Response("shared-token", { status: 200 }))

    await expect(Promise.all([p1, p2])).resolves.toEqual([
      "translated:first",
      "translated:second",
    ])

    expect(authCalls).toBe(1)
    expect(translateCalls).toBe(2)
  })
})
