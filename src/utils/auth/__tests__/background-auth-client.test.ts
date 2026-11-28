import { AUTH_BASE_PATH } from "@read-frog/definitions"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { env } from "@/env"

const { fetchWithSessionTokenMock } = vi.hoisted(() => ({
  fetchWithSessionTokenMock: vi.fn<typeof fetch>(async () => Response.json(null)),
}))

vi.mock("../safari-session", () => ({ fetchWithSessionToken: fetchWithSessionTokenMock }))

// The client takes its options when it is made, so each test makes it afresh.
async function loadClient() {
  vi.resetModules()
  const { backgroundAuthClient } = await import("../background-auth-client")
  return backgroundAuthClient
}

describe("backgroundAuthClient", () => {
  const plainFetch = vi.fn<typeof fetch>(async () => Response.json(null))

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", plainFetch)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("asks for the session with the session-carrying fetch in Safari", async () => {
    vi.stubEnv("BROWSER", "safari")
    const client = await loadClient()

    await client.getSession()

    expect(fetchWithSessionTokenMock).toHaveBeenCalledOnce()
    const [input] = fetchWithSessionTokenMock.mock.calls[0]!
    expect(new Request(input).url).toBe(`${env.WXT_API_URL}${AUTH_BASE_PATH}/get-session`)
    expect(plainFetch).not.toHaveBeenCalled()
  })

  it.each(["chrome", "edge", "firefox"])(
    "asks for the session with plain fetch in %s",
    async (target) => {
      vi.stubEnv("BROWSER", target)
      const client = await loadClient()

      await client.getSession()

      expect(plainFetch).toHaveBeenCalledOnce()
      expect(fetchWithSessionTokenMock).not.toHaveBeenCalled()
    },
  )
})
