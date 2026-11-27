import type { Browser } from "#imports"
import { AUTH_BASE_PATH } from "@read-frog/definitions"
import { afterEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { env } from "@/env"

const API = env.WXT_API_URL
const GET_SESSION = `${API}${AUTH_BASE_PATH}/get-session`
const SIGN_OUT = `${API}${AUTH_BASE_PATH}/sign-out`
const RPC = `${API}/api/rpc/featureAccess/status`

const DAY = 24 * 60 * 60
/** When a cookie expires unless a test says otherwise, in seconds. */
const COOKIE_ENDS = 2_000_000_000
/** When the API says a session ends unless a test says otherwise: a week later. */
const SESSION_ENDS = new Date((COOKIE_ENDS + 7 * DAY) * 1000).toISOString()

const PRODUCTION = "__Secure-better-auth.session_token"
const STAGING = "__Secure-readfrog-staging.session_token"

function sessionCookie(overrides: Partial<Browser.cookies.Cookie> = {}): Browser.cookies.Cookie {
  return {
    name: PRODUCTION,
    // Percent-encoded, as better-auth sets it: it must go out exactly so.
    value: "production-token.signature%2B%3D",
    domain: new URL(API).hostname,
    hostOnly: true,
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "lax",
    session: false,
    expirationDate: COOKIE_ENDS,
    storeId: "0",
    ...overrides,
  }
}

function stagingCookie(overrides: Partial<Browser.cookies.Cookie> = {}) {
  return sessionCookie({ name: STAGING, value: "staging-token.signature", ...overrides })
}

interface SeenRequest {
  url: string
  method: string
  authorization: string | null
}

/**
 * The browser's cookies, Read Frog's access to the API's site, and an API that
 * takes the values in `sessions`, each ending when it says.
 */
interface World {
  jar: Browser.cookies.Cookie[]
  access: boolean
  sessions: Map<string, string>
  /** Answers in place of the API, for requests it returns something for. */
  respond?: (request: Request) => Response | undefined
  requests: SeenRequest[]
}

function newWorld(overrides: Partial<World> = {}): World {
  return { jar: [], access: true, sessions: new Map(), requests: [], ...overrides }
}

function fakeApi(world: World, request: Request): Response {
  const authorization = request.headers.get("Authorization")
  world.requests.push({ url: request.url, method: request.method, authorization })
  const answer = world.respond?.(request)
  if (answer) return answer

  const endsAt = world.sessions.get(authorization?.replace(/^Bearer /, "") ?? "")
  if (request.url === GET_SESSION) {
    return Response.json(endsAt ? { session: { expiresAt: endsAt }, user: { id: "user-1" } } : null)
  }
  return Response.json({ ok: true })
}

/**
 * The module afresh, so what it keeps between calls starts empty, with the
 * browser it sees faked from `world`.
 */
async function load(world: World) {
  vi.resetModules()
  const mocks = {
    contains: vi.fn<(permissions: Browser.permissions.Permissions) => Promise<boolean>>(
      async () => world.access,
    ),
    getAll: vi.fn<(details: Browser.cookies.GetAllDetails) => Promise<Browser.cookies.Cookie[]>>(
      async () => world.jar.map((cookie) => ({ ...cookie })),
    ),
    set: vi.fn<(details: Browser.cookies.SetDetails) => Promise<Browser.cookies.Cookie | null>>(
      async (details) => {
        world.jar = world.jar.map((cookie) =>
          cookie.name === details.name
            ? { ...cookie, expirationDate: details.expirationDate }
            : cookie,
        )
        return null
      },
    ),
    remove: vi.fn<
      (details: Browser.cookies.CookieDetails) => Promise<Browser.cookies.CookieDetails>
    >(async (details) => {
      world.jar = world.jar.filter((cookie) => cookie.name !== details.name)
      return details
    }),
    onCookieChanged: vi.fn<(listener: () => void) => void>(),
    onPermissionAdded: vi.fn<(listener: () => void) => void>(),
    onPermissionRemoved: vi.fn<(listener: () => void) => void>(),
    fetch: vi.fn<typeof fetch>(async (input, init) => fakeApi(world, new Request(input, init))),
  }
  browser.permissions.contains = mocks.contains
  browser.cookies.getAll = mocks.getAll
  browser.cookies.set = mocks.set
  browser.cookies.remove = mocks.remove
  browser.cookies.onChanged.addListener = mocks.onCookieChanged
  browser.permissions.onAdded.addListener = mocks.onPermissionAdded
  browser.permissions.onRemoved.addListener = mocks.onPermissionRemoved
  vi.stubGlobal("fetch", mocks.fetch)
  await browser.storage.session.clear()

  const subject = await import("../safari-session")
  return { ...subject, mocks }
}

/** Lets whatever the module started on its own run to the end. */
async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 5))
}

afterEach(async () => {
  // What a test started on its own ends before the next one fakes the browser.
  await settle()
  vi.unstubAllGlobals()
})

describe("fetchWithSessionToken", () => {
  it.each([
    ["another site", "https://example.com/api/identity/get-session"],
    ["a site whose name starts with the API's", `${API}.example.com/api/identity/get-session`],
  ])("sends a request to %s as it came, reading no cookie", async (_, url) => {
    const w = newWorld({ jar: [sessionCookie()] })
    const { fetchWithSessionToken, mocks } = await load(w)

    await fetchWithSessionToken(url, { headers: { "X-Kept": "yes" } })

    expect(w.requests).toEqual([{ url, method: "GET", authorization: null }])
    const sent = mocks.fetch.mock.calls[0]![0] as Request
    expect(sent.headers.get("X-Kept")).toBe("yes")
    expect(mocks.contains).not.toHaveBeenCalled()
    expect(mocks.getAll).not.toHaveBeenCalled()
  })

  it("without access to the API's site, reads no cookie and sends no session", async () => {
    const w = newWorld({ jar: [sessionCookie()], access: false })
    const { fetchWithSessionToken, mocks } = await load(w)

    await fetchWithSessionToken(GET_SESSION)

    expect(w.requests).toEqual([{ url: GET_SESSION, method: "GET", authorization: null }])
    expect(mocks.contains).toHaveBeenCalledWith({
      origins: [`${new URL(API).protocol}//${new URL(API).hostname}/*`],
    })
    expect(mocks.getAll).not.toHaveBeenCalled()
    expect(mocks.set).not.toHaveBeenCalled()
  })

  it("sends no session when the access can't be checked", async () => {
    const w = newWorld({ jar: [sessionCookie()] })
    const { fetchWithSessionToken, mocks } = await load(w)
    mocks.contains.mockRejectedValue(new Error("not a valid pattern"))

    await fetchWithSessionToken(RPC)

    expect(w.requests).toEqual([{ url: RPC, method: "GET", authorization: null }])
    expect(mocks.getAll).not.toHaveBeenCalled()
  })

  it("sends the one session cookie as it is stored, without asking the API which", async () => {
    const cookie = sessionCookie()
    const w = newWorld({
      jar: [sessionCookie({ name: "better-auth.session_data", value: "cache" }), cookie],
    })
    const { fetchWithSessionToken, mocks } = await load(w)

    await fetchWithSessionToken(RPC, { method: "POST", body: "{}" })

    expect(w.requests[0]).toEqual({
      url: RPC,
      method: "POST",
      authorization: `Bearer ${cookie.value}`,
    })
    expect(mocks.getAll).toHaveBeenCalledWith({ url: API })
  })

  it.each([
    ["production", PRODUCTION],
    ["staging", STAGING],
  ])(
    "with production's and staging's cookies, asks a %s API about each once and sends the one it takes",
    async (_, taken) => {
      const cookies = [stagingCookie(), sessionCookie()]
      const ours = cookies.find((cookie) => cookie.name === taken)!
      const w = newWorld({ jar: cookies, sessions: new Map([[ours.value, SESSION_ENDS]]) })
      const { fetchWithSessionToken } = await load(w)

      await fetchWithSessionToken(RPC)
      await fetchWithSessionToken(RPC)

      const probes = w.requests.filter((request) => request.url === GET_SESSION)
      // One value each, and never both in one request.
      expect(probes.map((request) => request.authorization)).toEqual(
        expect.arrayContaining([`Bearer ${ours.value}`]),
      )
      expect(new Set(probes.map((request) => request.authorization)).size).toBe(probes.length)
      expect(probes.length).toBeLessThanOrEqual(2)
      expect(w.requests.filter((request) => request.url === RPC)).toEqual([
        { url: RPC, method: "GET", authorization: `Bearer ${ours.value}` },
        { url: RPC, method: "GET", authorization: `Bearer ${ours.value}` },
      ])

      // Kept by name, with no value in sight.
      const kept = JSON.stringify(await browser.storage.session.get())
      expect(kept).toContain(taken)
      for (const cookie of cookies) expect(kept).not.toContain(cookie.value)
    },
  )

  it("remembers that the API took neither cookie, until the cookies change", async () => {
    const w = newWorld({ jar: [stagingCookie(), sessionCookie()] })
    const { fetchWithSessionToken } = await load(w)

    await fetchWithSessionToken(RPC)
    await fetchWithSessionToken(RPC)
    expect(w.requests.map((request) => request.url)).toEqual([GET_SESSION, GET_SESSION, RPC, RPC])
    expect(w.requests.filter((request) => request.url === RPC)).toEqual([
      { url: RPC, method: "GET", authorization: null },
      { url: RPC, method: "GET", authorization: null },
    ])

    // Signing in again on the website sets a new value under the same name.
    const signedIn = sessionCookie({ value: "new-production-token.signature" })
    w.jar = [stagingCookie(), signedIn]
    w.sessions.set(signedIn.value, SESSION_ENDS)
    w.requests = []
    await fetchWithSessionToken(RPC)

    expect(w.requests.at(-1)).toEqual({
      url: RPC,
      method: "GET",
      authorization: `Bearer ${signedIn.value}`,
    })
  })

  it("asks the API again next time when it couldn't be reached", async () => {
    const w = newWorld({ jar: [stagingCookie(), sessionCookie()] })
    w.respond = (request) =>
      request.url === GET_SESSION ? new Response("unavailable", { status: 503 }) : undefined
    const { fetchWithSessionToken } = await load(w)

    await fetchWithSessionToken(RPC)
    expect(w.requests.at(-1)).toEqual({ url: RPC, method: "GET", authorization: null })

    w.respond = undefined
    w.sessions.set(sessionCookie().value, SESSION_ENDS)
    w.requests = []
    await fetchWithSessionToken(RPC)

    expect(w.requests.filter((request) => request.url === GET_SESSION).length).toBeGreaterThan(0)
    expect(w.requests.at(-1)?.authorization).toBe(`Bearer ${sessionCookie().value}`)
  })

  it("asks the API once for requests going out together", async () => {
    const cookie = sessionCookie()
    const w = newWorld({
      jar: [stagingCookie(), cookie],
      sessions: new Map([[cookie.value, SESSION_ENDS]]),
    })
    const { fetchWithSessionToken } = await load(w)

    await Promise.all([
      fetchWithSessionToken(RPC),
      fetchWithSessionToken(RPC),
      fetchWithSessionToken(RPC),
    ])

    expect(w.requests.filter((request) => request.url === GET_SESSION).length).toBeLessThanOrEqual(
      2,
    )
    expect(w.requests.filter((request) => request.url === RPC)).toHaveLength(3)
  })
})

describe("the cookie changes the API's responses ask for", () => {
  it("clears the session cookie once the API has signed the session out", async () => {
    const cookie = sessionCookie()
    const w = newWorld({ jar: [cookie] })
    const { fetchWithSessionToken, mocks } = await load(w)

    await fetchWithSessionToken(SIGN_OUT, { method: "POST", body: "{}" })

    expect(w.requests).toEqual([
      { url: SIGN_OUT, method: "POST", authorization: `Bearer ${cookie.value}` },
    ])
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith({
      url: API,
      name: cookie.name,
      storeId: cookie.storeId,
    })
    expect(w.jar).toEqual([])
  })

  it("keeps the session cookie when signing out fails", async () => {
    const w = newWorld({ jar: [sessionCookie()] })
    w.respond = (request) =>
      request.url === SIGN_OUT ? new Response("oops", { status: 500 }) : undefined
    const { fetchWithSessionToken, mocks } = await load(w)

    await fetchWithSessionToken(SIGN_OUT, { method: "POST", body: "{}" })

    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it("extends the session cookie to when the API says the session ends, and changes nothing else", async () => {
    const cookie = sessionCookie()
    const w = newWorld({ jar: [cookie], sessions: new Map([[cookie.value, SESSION_ENDS]]) })
    const { fetchWithSessionToken, mocks } = await load(w)

    const response = await fetchWithSessionToken(GET_SESSION)

    // The caller still reads the whole answer.
    await expect(response.json()).resolves.toEqual({
      session: { expiresAt: SESSION_ENDS },
      user: { id: "user-1" },
    })
    expect(mocks.set).toHaveBeenCalledExactlyOnceWith({
      url: API,
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      expirationDate: Date.parse(SESSION_ENDS) / 1000,
      storeId: cookie.storeId,
    })
  })

  it("keeps a cookie set for the whole site set for it", async () => {
    const cookie = sessionCookie({
      domain: ".readfrog.test",
      hostOnly: false,
      sameSite: "no_restriction",
    })
    const w = newWorld({ jar: [cookie], sessions: new Map([[cookie.value, SESSION_ENDS]]) })
    const { fetchWithSessionToken, mocks } = await load(w)

    await fetchWithSessionToken(GET_SESSION)

    expect(mocks.set).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ domain: ".readfrog.test", sameSite: "no_restriction" }),
    )
  })

  it.each<[string, { sessionEnds?: string; cookie?: Partial<Browser.cookies.Cookie> }]>([
    [
      "the session ends no later than the cookie",
      { sessionEnds: new Date(COOKIE_ENDS * 1000).toISOString() },
    ],
    ["the API took no session from it", { sessionEnds: undefined }],
    [
      "the cookie ends with the browser session",
      { sessionEnds: SESSION_ENDS, cookie: { expirationDate: undefined, session: true } },
    ],
  ])("leaves the cookie alone when %s", async (_, { sessionEnds, cookie: overrides }) => {
    const cookie = sessionCookie(overrides)
    const w = newWorld({ jar: [cookie] })
    if (sessionEnds) w.sessions.set(cookie.value, sessionEnds)
    const { fetchWithSessionToken, mocks } = await load(w)

    await fetchWithSessionToken(GET_SESSION)

    expect(mocks.set).not.toHaveBeenCalled()
  })

  it.each([
    ["signed out on the website", () => []],
    ["signed in again on the website", () => [sessionCookie({ value: "someone-else.signature" })]],
  ])("leaves the cookie alone when it was %s meanwhile", async (_, jarAfter) => {
    const cookie = sessionCookie()
    const w = newWorld({ jar: [cookie], sessions: new Map([[cookie.value, SESSION_ENDS]]) })
    w.respond = () => {
      w.jar = jarAfter()
      return undefined
    }
    const { fetchWithSessionToken, mocks } = await load(w)

    await fetchWithSessionToken(GET_SESSION)

    expect(mocks.set).not.toHaveBeenCalled()
  })

  it("does nothing once access to the API's site is gone", async () => {
    const cookie = sessionCookie()
    const w = newWorld({ jar: [cookie], sessions: new Map([[cookie.value, SESSION_ENDS]]) })
    w.respond = () => {
      w.access = false
      return undefined
    }
    const { fetchWithSessionToken, mocks } = await load(w)

    await fetchWithSessionToken(GET_SESSION)

    expect(mocks.set).not.toHaveBeenCalled()
  })

  it("extends only the cookie the API took when there were several", async () => {
    const cookie = sessionCookie()
    const w = newWorld({
      jar: [stagingCookie(), cookie],
      sessions: new Map([[cookie.value, SESSION_ENDS]]),
    })
    const { fetchWithSessionToken, mocks } = await load(w)

    await fetchWithSessionToken(GET_SESSION)

    expect(mocks.set).toHaveBeenCalled()
    expect(mocks.set.mock.calls.every(([details]) => details.name === PRODUCTION)).toBe(true)
    expect(w.jar.find((each) => each.name === STAGING)?.expirationDate).toBe(COOKIE_ENDS)
  })
})

describe("asking get-session once a day", () => {
  const POST = { method: "POST", body: "{}" }
  const START = Date.parse("2026-11-27T12:00:00Z")

  function signedIn() {
    const cookie = sessionCookie()
    const w = newWorld({ jar: [cookie], sessions: new Map([[cookie.value, SESSION_ENDS]]) })
    return { cookie, w }
  }

  function asks(w: World) {
    return w.requests.filter((request) => request.url === GET_SESSION)
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  it("asks after a request that carries the session, and extends the cookie with the answer", async () => {
    const { cookie, w } = signedIn()
    const { fetchWithSessionToken, mocks } = await load(w)

    await fetchWithSessionToken(RPC, POST)
    await settle()

    expect(w.requests).toEqual([
      { url: RPC, method: "POST", authorization: `Bearer ${cookie.value}` },
      { url: GET_SESSION, method: "GET", authorization: `Bearer ${cookie.value}` },
    ])
    expect(mocks.set).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        name: cookie.name,
        value: cookie.value,
        expirationDate: Date.parse(SESSION_ENDS) / 1000,
      }),
    )
  })

  it("asks again a day after the last get-session, the pages' own included", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(START)
    const { w } = signedIn()
    const { fetchWithSessionToken } = await load(w)

    // As the popup does when it opens.
    await fetchWithSessionToken(GET_SESSION)
    await fetchWithSessionToken(RPC, POST)
    await settle()
    expect(asks(w)).toHaveLength(1)

    vi.setSystemTime(START + DAY * 1000 - 1)
    await fetchWithSessionToken(RPC, POST)
    await settle()
    expect(asks(w)).toHaveLength(1)

    vi.setSystemTime(START + DAY * 1000)
    await fetchWithSessionToken(RPC, POST)
    await settle()
    expect(asks(w)).toHaveLength(2)
  })

  it("counts asking the API which cookie is ours", async () => {
    const cookie = sessionCookie()
    const w = newWorld({
      jar: [stagingCookie(), cookie],
      sessions: new Map([[cookie.value, SESSION_ENDS]]),
    })
    const { fetchWithSessionToken } = await load(w)

    await fetchWithSessionToken(RPC, POST)
    await settle()

    expect(w.requests.map((request) => request.url)).toEqual([GET_SESSION, GET_SESSION, RPC])
  })

  it("asks once for requests that finish together", async () => {
    const { w } = signedIn()
    const { fetchWithSessionToken } = await load(w)

    await Promise.all(Array.from({ length: 10 }, () => fetchWithSessionToken(RPC, POST)))
    await settle()

    expect(asks(w)).toHaveLength(1)
  })

  it.each<[string, () => Response]>([
    ["answered with an error", () => new Response("unavailable", { status: 503 })],
    [
      "couldn't be reached",
      () => {
        throw new TypeError("Load failed")
      },
    ],
  ])("waits a day after asking an API that %s, too", async (_, failure) => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(START)
    const { w } = signedIn()
    w.respond = (request) => (request.url === GET_SESSION ? failure() : undefined)
    const { fetchWithSessionToken, mocks } = await load(w)

    await fetchWithSessionToken(RPC, POST)
    await settle()
    await fetchWithSessionToken(RPC, POST)
    await settle()
    expect(asks(w)).toHaveLength(1)
    expect(mocks.set).not.toHaveBeenCalled()

    vi.setSystemTime(START + DAY * 1000)
    await fetchWithSessionToken(RPC, POST)
    await settle()
    expect(asks(w)).toHaveLength(2)
  })

  it("asks again in a new browser session", async () => {
    const { w } = signedIn()

    await (await load(w)).fetchWithSessionToken(RPC, POST)
    await settle()
    await (await load(w)).fetchWithSessionToken(RPC, POST)
    await settle()

    expect(asks(w)).toHaveLength(2)
  })

  it("asks nothing for a reader who isn't signed in", async () => {
    const w = newWorld()
    const { fetchWithSessionToken } = await load(w)

    await fetchWithSessionToken(RPC, POST)
    await settle()

    expect(w.requests).toEqual([{ url: RPC, method: "POST", authorization: null }])
  })

  it("asks nothing once the reader has signed out", async () => {
    const { cookie, w } = signedIn()
    const { fetchWithSessionToken } = await load(w)

    await fetchWithSessionToken(SIGN_OUT, POST)
    await settle()

    expect(w.requests).toEqual([
      { url: SIGN_OUT, method: "POST", authorization: `Bearer ${cookie.value}` },
    ])
  })
})

describe("onSessionCookiesChange", () => {
  async function watch(w: World) {
    const loaded = await load(w)
    const changed = vi.fn<() => void>()
    loaded.onSessionCookiesChange(changed)
    await settle()
    const report = loaded.mocks.onCookieChanged.mock.calls[0]![0]
    return { ...loaded, changed, report }
  }

  it("takes the cookies of a new browser session as they are", async () => {
    const { changed, mocks } = await watch(newWorld({ jar: [sessionCookie()] }))

    expect(mocks.getAll).toHaveBeenCalledOnce()
    expect(changed).not.toHaveBeenCalled()
  })

  it("tells when the website signs in, signs out, or signs in as someone else", async () => {
    const w = newWorld()
    const { changed, report } = await watch(w)

    w.jar = [sessionCookie()]
    report()
    await settle()
    expect(changed).toHaveBeenCalledTimes(1)

    w.jar = [sessionCookie({ value: "someone-else.signature" })]
    report()
    await settle()
    expect(changed).toHaveBeenCalledTimes(2)

    w.jar = []
    report()
    await settle()
    expect(changed).toHaveBeenCalledTimes(3)
  })

  it("ignores other cookies, and sessions extended, the extension's own extensions included", async () => {
    const cookie = sessionCookie()
    const w = newWorld({ jar: [cookie], sessions: new Map([[cookie.value, SESSION_ENDS]]) })
    const { changed, report, fetchWithSessionToken, mocks } = await watch(w)

    // The website extends the session: same value, later expiry.
    w.jar = [sessionCookie({ expirationDate: COOKIE_ENDS + DAY })]
    report()
    // Read Frog extends it, which Safari reports like any other change.
    await fetchWithSessionToken(GET_SESSION)
    expect(mocks.set).toHaveBeenCalledOnce()
    report()
    // Another site's cookie.
    w.jar = [...w.jar, sessionCookie({ name: "theme", value: "dark" })]
    report()
    await settle()

    expect(changed).not.toHaveBeenCalled()
  })

  it("tells when access to the API's site is granted or taken away", async () => {
    const w = newWorld({ jar: [sessionCookie()], access: false })
    const { changed, mocks } = await watch(w)
    const onAdded = mocks.onPermissionAdded.mock.calls[0]![0]
    const onRemoved = mocks.onPermissionRemoved.mock.calls[0]![0]

    w.access = true
    onAdded()
    await settle()
    expect(changed).toHaveBeenCalledTimes(1)

    w.access = false
    onRemoved()
    await settle()
    expect(changed).toHaveBeenCalledTimes(2)
  })

  it("looks once at a time however many reports arrive, and once more after", async () => {
    const w = newWorld()
    const { changed, report, mocks } = await watch(w)

    w.jar = [sessionCookie()]
    for (let i = 0; i < 100; i++) report()
    await settle()

    // The first look, the one the burst started, and one for the rest of it.
    expect(mocks.getAll).toHaveBeenCalledTimes(3)
    expect(changed).toHaveBeenCalledOnce()
  })

  it("watches the browser once for every listener, and tells each", async () => {
    const w = newWorld()
    const { onSessionCookiesChange, changed, report, mocks } = await watch(w)
    const another = vi.fn<() => void>()
    onSessionCookiesChange(another)

    w.jar = [sessionCookie()]
    report()
    await settle()

    expect(mocks.onCookieChanged).toHaveBeenCalledOnce()
    expect(changed).toHaveBeenCalledOnce()
    expect(another).toHaveBeenCalledOnce()
  })

  it("keeps no cookie value", async () => {
    const cookie = sessionCookie()
    await watch(newWorld({ jar: [stagingCookie(), cookie] }))

    const kept = JSON.stringify(await browser.storage.session.get())
    expect(kept).not.toContain(cookie.value)
    expect(kept).not.toContain(stagingCookie().value)
    expect(JSON.stringify(await browser.storage.local.get())).toBe("{}")
  })
})
