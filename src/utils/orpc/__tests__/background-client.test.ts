import { ORPC_PREFIX } from "@read-frog/definitions"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { env } from "@/env"
import { backgroundOrpcClient } from "../background-client"

const { fetchWithSessionTokenMock } = vi.hoisted(() => ({
  fetchWithSessionTokenMock: vi.fn<typeof fetch>(),
}))

vi.mock("../../auth/safari-session", () => ({ fetchWithSessionToken: fetchWithSessionTokenMock }))

function allowed() {
  return Response.json({ json: { allowed: true }, meta: [] })
}

describe("backgroundOrpcClient", () => {
  const plainFetch = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.clearAllMocks()
    plainFetch.mockImplementation(async () => allowed())
    fetchWithSessionTokenMock.mockImplementation(async () => allowed())
    vi.stubGlobal("fetch", plainFetch)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("calls the API with the session-carrying fetch in Safari", async () => {
    vi.stubEnv("BROWSER", "safari")

    await expect(
      backgroundOrpcClient.featureAccess.status({ featureKey: "difficult_words" }),
    ).resolves.toEqual({ allowed: true })

    expect(fetchWithSessionTokenMock).toHaveBeenCalledOnce()
    const [request, init] = fetchWithSessionTokenMock.mock.calls[0]!
    expect((request as Request).url).toBe(`${env.WXT_API_URL}${ORPC_PREFIX}/featureAccess/status`)
    expect(init).toMatchObject({ credentials: "include" })
    expect(plainFetch).not.toHaveBeenCalled()
  })

  it.each(["chrome", "edge", "firefox"])("calls the API with plain fetch in %s", async (target) => {
    vi.stubEnv("BROWSER", target)

    await backgroundOrpcClient.featureAccess.status({ featureKey: "difficult_words" })

    expect(plainFetch).toHaveBeenCalledOnce()
    expect(fetchWithSessionTokenMock).not.toHaveBeenCalled()
  })
})
