import type { RemoteSiteRulesDocument } from "@/utils/site-rules/remote/document"
import { Buffer } from "node:buffer"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { REMOTE_SITE_RULES_URL } from "@/utils/site-rules/remote/document"
import {
  getStoredRemoteSiteRules,
  setStoredRemoteSiteRules,
} from "@/utils/site-rules/remote/storage"
import {
  SITE_RULES_UPDATE_ALARM,
  setUpSiteRulesUpdate,
  updateRemoteSiteRules,
} from "../site-rules-update"

// Remote rules are off in tests; the scheduling tests need them on.
vi.mock("@/utils/site-rules/remote/document", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/site-rules/remote/document")>()),
  REMOTE_SITE_RULES_ENABLED: true,
}))

const KEY_ID = "test"

async function createSigner() {
  const { privateKey, publicKey } = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )
  const spki = Buffer.from(await crypto.subtle.exportKey("spki", publicKey)).toString("base64")
  return {
    publicKeys: { [KEY_ID]: spki },
    async sign(remote: unknown) {
      const payload = JSON.stringify(remote)
      const signature = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        privateKey,
        new TextEncoder().encode(payload),
      )
      return { keyId: KEY_ID, payload, signature: Buffer.from(signature).toString("base64") }
    },
  }
}

function remoteDocument(revision: number): RemoteSiteRulesDocument {
  return {
    format: 1,
    revision,
    extensionVersion: "1.58.1",
    rules: [{ id: "a", matches: "a.com" }],
  }
}

function serve(body: unknown, init?: ResponseInit) {
  const fetchMock = vi.fn<typeof fetch>(
    async () => new Response(typeof body === "string" ? body : JSON.stringify(body), init),
  )
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

beforeEach(() => {
  fakeBrowser.reset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("updateRemoteSiteRules", () => {
  it("stores a verified document newer than the stored one", async () => {
    const signer = await createSigner()
    const fetchMock = serve(await signer.sign(remoteDocument(200)))

    expect(await updateRemoteSiteRules(signer.publicKeys)).toBe("updated")
    expect(fetchMock).toHaveBeenCalledWith(
      REMOTE_SITE_RULES_URL,
      expect.objectContaining({ cache: "no-cache" }),
    )
    expect(await getStoredRemoteSiteRules()).toEqual({
      ...remoteDocument(200),
      fetchedAt: expect.any(Number),
    })
  })

  it("keeps the stored document when the fetched one is not newer", async () => {
    const signer = await createSigner()
    await setStoredRemoteSiteRules({ ...remoteDocument(200), fetchedAt: 1 })

    serve(await signer.sign(remoteDocument(200)))
    expect(await updateRemoteSiteRules(signer.publicKeys)).toBe("unchanged")
    // Say, a CDN copy from before the last publish.
    serve(await signer.sign(remoteDocument(100)))
    expect(await updateRemoteSiteRules(signer.publicKeys)).toBe("unchanged")

    expect(await getStoredRemoteSiteRules()).toEqual({ ...remoteDocument(200), fetchedAt: 1 })
  })

  it("refuses documents that do not verify", async () => {
    const signer = await createSigner()
    const stranger = await createSigner()

    serve(await stranger.sign(remoteDocument(200)))
    expect(await updateRemoteSiteRules(signer.publicKeys)).toBe("failed")

    const signed = await signer.sign(remoteDocument(200))
    serve({ ...signed, payload: JSON.stringify(remoteDocument(300)) })
    expect(await updateRemoteSiteRules(signer.publicKeys)).toBe("failed")

    expect(await getStoredRemoteSiteRules()).toBeNull()
  })

  it("refuses a verified document in a format this build does not read", async () => {
    const signer = await createSigner()
    serve(await signer.sign({ ...remoteDocument(200), format: 2 }))

    expect(await updateRemoteSiteRules(signer.publicKeys)).toBe("failed")
    expect(await getStoredRemoteSiteRules()).toBeNull()
  })

  it.each([
    ["a missing file", () => serve("", { status: 404 })],
    ["a server error", () => serve("", { status: 503 })],
    ["a challenge page instead of JSON", () => serve("<html>Just a moment...</html>")],
    [
      "a network failure",
      () =>
        vi.stubGlobal(
          "fetch",
          vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch")),
        ),
    ],
  ])("keeps the current rules on %s", async (_case, respond) => {
    const signer = await createSigner()
    await setStoredRemoteSiteRules({ ...remoteDocument(200), fetchedAt: 1 })
    respond()

    expect(await updateRemoteSiteRules(signer.publicKeys)).toBe("failed")
    expect(await getStoredRemoteSiteRules()).toEqual({ ...remoteDocument(200), fetchedAt: 1 })
  })
})

describe("setUpSiteRulesUpdate", () => {
  it("schedules a check every six hours that starts a few minutes in", async () => {
    const before = Date.now()
    setUpSiteRulesUpdate()

    const alarm = await vi.waitUntil(() => fakeBrowser.alarms.get(SITE_RULES_UPDATE_ALARM))
    expect(alarm.periodInMinutes).toBe(360)
    expect(alarm.scheduledTime).toBeGreaterThanOrEqual(before + 60_000)
    expect(alarm.scheduledTime).toBeLessThanOrEqual(Date.now() + 5 * 60_000)
  })

  it("keeps the countdown of an alarm that already exists", async () => {
    await fakeBrowser.alarms.create(SITE_RULES_UPDATE_ALARM, {
      delayInMinutes: 30,
      periodInMinutes: 360,
    })
    const existing = await fakeBrowser.alarms.get(SITE_RULES_UPDATE_ALARM)

    setUpSiteRulesUpdate()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(await fakeBrowser.alarms.get(SITE_RULES_UPDATE_ALARM)).toEqual(existing)
  })

  it("checks for new rules when its alarm fires", async () => {
    const fetchMock = serve("", { status: 404 })
    setUpSiteRulesUpdate()

    const firedAlarm = (name: string) => ({
      name,
      scheduledTime: Date.now(),
      persistAcrossSessions: true,
    })
    await fakeBrowser.alarms.onAlarm.trigger(firedAlarm("config-backup"))
    expect(fetchMock).not.toHaveBeenCalled()

    await fakeBrowser.alarms.onAlarm.trigger(firedAlarm(SITE_RULES_UPDATE_ALARM))
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
