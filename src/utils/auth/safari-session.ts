import type { Browser } from "#imports"
import { AUTH_BASE_PATH } from "@read-frog/definitions"
import { browser, storage } from "#imports"
import { env } from "@/env"
import { DEFAULT_PROXY_CACHE_TTL_MS } from "@/utils/constants/proxy-fetch"
import { createLogger } from "@/utils/logging/logger"

// Safari's extension background sends no cookies with its requests and keeps
// none that a response sets (webkit.org/b/260676), so the API can't see the
// session the way it does in other browsers, and what the API does to the
// session cookie never reaches it. In Safari the background reads the session
// cookie itself and sends its value as `Authorization: Bearer <value>`, exactly
// as the cookie stores it, and makes the cookie changes the API's responses
// ask for itself.
//
// Only Safari builds use anything here, but the others import it too, and
// whatever runs on load stays in their bundles. So nothing here does: the
// addresses are worked out where they are used, and the logger is marked pure.

const log = /* @__PURE__ */ createLogger("auth/safari-session")

/** Which session cookie the API took, for the session cookies it was chosen among. */
const CHOICE_KEY = "session:safariSessionCookieChoice" as const
/** The session cookies as last seen, to tell when they change. */
const SEEN_KEY = "session:safariSessionCookiesSeen" as const
/** When a get-session carrying the session last went out, in milliseconds. */
const ASKED_KEY = "session:safariSessionAskedAt" as const

interface SessionCookieChoice {
  /** The session cookies there were, as `describe` puts them. */
  among: string
  /** The one the API took, as `keyOf` puts it, or null when it took none. */
  chosen: string | null
}

/** What get-session answers: the session, or null when the request has none. */
type SessionAnswer = { session?: { expiresAt?: unknown } | null } | null

function authUrl(route: "get-session" | "sign-out"): URL {
  return new URL(`${env.WXT_API_URL}${AUTH_BASE_PATH}/${route}`)
}

/**
 * The session cookies a request to the API would carry, read only with access
 * to the API's site: without it, Safari asks the user before it lets them be
 * read. Safari also leaves out any cookie of a site it may not read, such as
 * one set on `readfrog.app` itself when only `api.readfrog.app` is allowed.
 *
 * The API names its cookie `<prefix>.session_token`, and staging and preview
 * APIs set their own prefix in place of the default `better-auth`, so any
 * prefix counts.
 */
export async function readSessionCookies(): Promise<Browser.cookies.Cookie[]> {
  try {
    const api = new URL(env.WXT_API_URL)
    // Without a port: Safari refuses a match pattern with one, and one without
    // covers them all.
    const apiHosts = `${api.protocol}//${api.hostname}/*`
    if (!(await browser.permissions.contains({ origins: [apiHosts] }))) return []
    const cookies = await browser.cookies.getAll({ url: env.WXT_API_URL })
    return cookies.filter((cookie) => cookie.name.endsWith(".session_token"))
  } catch (error) {
    log.warn("Could not read the session cookies", { error })
    return []
  }
}

/** A cookie as the browser tells it from others of the same name. */
function keyOf(cookie: Browser.cookies.Cookie): string {
  return `${cookie.name};${cookie.domain};${cookie.path}`
}

async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

/**
 * Which session cookies these are, and which sessions they hold, without
 * keeping any value: each value is told apart by its digest. Signing in sets a
 * new value; a session extended keeps its value, and so its description.
 */
async function describe(cookies: Browser.cookies.Cookie[]): Promise<string> {
  const lines = await Promise.all(
    cookies.map(async (cookie) => `${keyOf(cookie)};${await digest(cookie.value)}`),
  )
  return lines.sort().join("\n")
}

/**
 * Moves the session cookie's expiry to when the API says the session ends, as
 * the cookie the API sends back with an extended session would. Only a later
 * end counts, and only while the cookie still holds the value that was sent:
 * a sign-out on the website meanwhile must stay signed out. A cookie that ends
 * with the browser session is left so. Never rejects.
 */
async function extendSessionCookie(sent: Browser.cookies.Cookie, answer: SessionAnswer) {
  const expiresAt = answer?.session?.expiresAt
  // Whole seconds, as Safari keeps a cookie's expiry: the API's end has
  // milliseconds, so the cookie would otherwise always look a moment short of
  // it, and be set again after every get-session.
  const endsAt =
    typeof expiresAt === "string" ? Math.floor(Date.parse(expiresAt) / 1000) : Number.NaN
  if (!Number.isFinite(endsAt)) return
  try {
    const cookie = (await readSessionCookies()).find((each) => keyOf(each) === keyOf(sent))
    if (cookie?.value !== sent.value || cookie.expirationDate === undefined) return
    if (cookie.expirationDate >= endsAt) return
    await browser.cookies.set({
      url: env.WXT_API_URL,
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      expirationDate: endsAt,
      storeId: cookie.storeId,
      // A host-only cookie has to stay one, and naming its domain would make it
      // a cookie for every subdomain as well.
      ...(!cookie.hostOnly && { domain: cookie.domain }),
    })
  } catch (error) {
    log.warn("Could not extend the session cookie", { error })
  }
}

/**
 * Sends `request` carrying the session `cookie` holds, then does to the cookie
 * what the response tells the browser to, which Safari's background leaves
 * undone: clears it when the session is signed out, and extends it when the
 * session is. A get-session is noted when it goes out, for `askDailyForSession`.
 */
async function sendWithSession(cookie: Browser.cookies.Cookie, request: Request) {
  request.headers.set("Authorization", `Bearer ${cookie.value}`)
  const route = new URL(request.url).pathname
  const isGetSession = request.method === "GET" && route === authUrl("get-session").pathname
  if (isGetSession) {
    await storage
      .setItem(ASKED_KEY, Date.now())
      .catch((error) => log.warn("Could not note the session asked for", { error }))
  }

  const response = await fetch(request)
  if (!response.ok) return response
  if (request.method === "POST" && route === authUrl("sign-out").pathname) {
    await browser.cookies
      .remove({ url: env.WXT_API_URL, name: cookie.name, storeId: cookie.storeId })
      .catch((error) => log.warn("Could not clear the session cookie", { error }))
  } else if (isGetSession) {
    const answer = (await response
      .clone()
      .json()
      .catch(() => null)) as SessionAnswer
    await extendSessionCookie(cookie, answer)
  }
  return response
}

function getSessionRequest(): Request {
  return new Request(authUrl("get-session"), { cache: "no-store" })
}

/** `true` or `false` when the API answered, `undefined` when it couldn't be asked. */
async function isTakenByApi(cookie: Browser.cookies.Cookie): Promise<boolean | undefined> {
  try {
    const response = await sendWithSession(cookie, getSessionRequest())
    if (!response.ok) return undefined
    const answer = (await response.json()) as SessionAnswer
    return Boolean(answer?.session)
  } catch {
    return undefined
  }
}

async function saveChoice(choice: SessionCookieChoice) {
  await storage
    .setItem<SessionCookieChoice>(CHOICE_KEY, choice)
    .catch((error) => log.warn("Could not keep the session cookie choice", { error }))
}

/** Asks the API about each cookie in turn; never rejects. */
async function ask(cookies: Browser.cookies.Cookie[], among: string): Promise<string | null> {
  let unanswered = false
  for (const cookie of cookies) {
    const taken = await isTakenByApi(cookie)
    if (taken) {
      await saveChoice({ among, chosen: keyOf(cookie) })
      return keyOf(cookie)
    }
    if (taken === undefined) unanswered = true
  }
  // An API that couldn't be reached took none for now, not for good.
  if (!unanswered) await saveChoice({ among, chosen: null })
  return null
}

let asking: { among: string; chosen: Promise<string | null> } | undefined

/**
 * The session cookie whose value goes to the API. Usually there is one. A
 * browser signed in to production and staging has one of each, on the same
 * site, and each API takes only its own; which one is ours can't be told from
 * the cookies, so the API is asked about each once. Its answer is kept by the
 * cookie's name, never its value, until the cookies change.
 */
async function pickSessionCookie(): Promise<Browser.cookies.Cookie | undefined> {
  const cookies = await readSessionCookies()
  if (cookies.length < 2) return cookies[0]

  const among = await describe(cookies)
  const saved = await storage.getItem<SessionCookieChoice>(CHOICE_KEY).catch(() => null)
  if (saved?.among === among) return cookies.find((cookie) => keyOf(cookie) === saved.chosen)

  // Requests going out together ask the API once between them.
  let current = asking
  if (current?.among !== among) {
    const started = { among, chosen: ask(cookies, among) }
    asking = current = started
    void started.chosen.then(() => {
      if (asking === started) asking = undefined
    })
  }
  const chosen = await current.chosen
  return cookies.find((cookie) => keyOf(cookie) === chosen)
}

let askingDaily = false

/**
 * Asks get-session when none carrying the session has gone out for a day. The
 * session cookie's expiry only moves with a get-session answer, and most
 * requests carrying the session are oRPC calls: the API extends the session
 * for them without saying until when. Without this, a reader who only
 * translates would be signed out a week after their last get-session, on the
 * website too. A day is how often the API extends a session, and how long
 * get-session stays cached for the pages. One ask at a time, and one that
 * fails waits a day as well. Never rejects.
 */
async function askDailyForSession() {
  if (askingDaily) return
  askingDaily = true
  try {
    const askedAt = await storage.getItem<number>(ASKED_KEY)
    if (askedAt !== null && Date.now() - askedAt < DEFAULT_PROXY_CACHE_TTL_MS) return
    const cookie = await pickSessionCookie()
    if (cookie) await sendWithSession(cookie, getSessionRequest())
  } catch (error) {
    log.warn("Could not ask for the session", { error })
  } finally {
    askingDaily = false
  }
}

/**
 * `fetch`, but a request to the API carries the session in Safari, the way a
 * cookie would in other browsers, and what the response does to the session
 * cookie is done. The value is read for each request and kept nowhere; a
 * request anywhere else goes out as it came.
 */
export async function fetchWithSessionToken(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const request = new Request(input, init)
  if (new URL(request.url).origin !== new URL(env.WXT_API_URL).origin) return await fetch(request)

  const cookie = await pickSessionCookie()
  if (!cookie) return await fetch(request)
  const response = await sendWithSession(cookie, request)
  // Once the request is done, so it waits for nothing, and a sign-out has
  // already cleared the cookie.
  void askDailyForSession()
  return response
}

const sessionChangeListeners: Array<() => void> = []
let checking: Promise<void> | null = null
let checkAgain = false

async function compareWithLastSeen() {
  const seen = await describe(await readSessionCookies())
  const lastSeen = await storage.getItem<string>(SEEN_KEY)
  if (seen === lastSeen) return
  await storage.setItem(SEEN_KEY, seen)
  // The first look of a browser session has nothing to compare with.
  if (lastSeen === null) return

  log.info("Session cookies changed")
  for (const listener of sessionChangeListeners) listener()
}

/** One look at a time; whatever changes meanwhile gets one more look after it. */
function checkSessionCookies() {
  if (checking) {
    checkAgain = true
    return
  }
  checking = compareWithLastSeen()
    .catch((error) => log.warn("Could not check the session cookies", { error }))
    .finally(() => {
      checking = null
      if (checkAgain) {
        checkAgain = false
        checkSessionCookies()
      }
    })
}

/**
 * Calls `listener` when the session the API would see changes: signing in or
 * out on the website, or Read Frog being allowed on the site or not. Not when
 * a session is only extended, which keeps the cookie's value; that includes
 * the extension extending it. Safari names neither the cookie that changed
 * nor its site (webkit.org/b/267514), and reports every cookie of every site,
 * a hundred times or more while some news pages load, so each report means a
 * look at our own cookies, one look at a time.
 */
export function onSessionCookiesChange(listener: () => void): void {
  sessionChangeListeners.push(listener)
  if (sessionChangeListeners.length > 1) return

  browser.cookies.onChanged.addListener(checkSessionCookies)
  browser.permissions.onAdded.addListener(checkSessionCookies)
  browser.permissions.onRemoved.addListener(checkSessionCookies)
  checkSessionCookies()
}
