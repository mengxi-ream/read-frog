import type { SyncedGlossary, SyncedTerm } from "../document"
import type { RemoteGlossaryRead } from "../drive-store"
import type { GlossarySnapshot } from "../merge-document"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { GLOSSARY_SYNC_SCHEMA_VERSION } from "../document"
import { planGlossarySync } from "../sync"

/**
 * The orchestrator's branching, with no Dexie and no network.
 *
 * These are the decisions that cannot be reached from `mergeGlossaryDocuments`'s
 * own tests — which side of the account boundary the base falls on, what an
 * absent file means, when the user has to be asked — and each of them is a
 * decision that loses data if it goes the wrong way.
 */

const EMAIL = "me@example.com"
const OTHER_EMAIL = "work@example.com"

const state = vi.hoisted(() => ({
  local: { glossaries: [], terms: [] } as GlossarySnapshot,
  base: null as { email: string; snapshot: GlossarySnapshot } | null,
  remote: { status: "absent" } as RemoteGlossaryRead,
  email: "me@example.com",
}))

vi.mock("@/utils/google-drive/auth", () => ({
  getValidAccessToken: async () => "token",
  getGoogleUserInfo: async () => ({ email: state.email }),
}))

vi.mock("../drive-store", () => ({
  readRemoteGlossary: async () => state.remote,
  writeRemoteGlossary: async () => ({ ok: true }),
}))

vi.mock("../local-store", async (importOriginal) => {
  // `fingerprint` is pure and is what the commit re-checks against, so it stays
  // real; only the two reads that touch Dexie are stood in for.
  const actual = await importOriginal<typeof import("../local-store")>()
  return {
    ...actual,
    readLocalGlossary: async () => state.local,
    readSyncBase: async () => state.base,
  }
})

const T0 = new Date("2026-01-01T00:00:00.000Z")

function glossary(id: string): SyncedGlossary {
  return {
    id,
    name: id,
    description: "",
    enabled: true,
    matchPatterns: [],
    createdAt: T0,
    updatedAt: T0,
  }
}

function term(glossaryId: string, source: string, target = `${source}-译`): SyncedTerm {
  return {
    id: `${glossaryId}-${source}`,
    glossaryId,
    matchKey: `i:${source.toLowerCase()}`,
    targetLang: "cmn",
    source,
    target,
    caseSensitive: false,
    enabled: true,
    updatedAt: T0,
  }
}

function snapshot(glossaries: SyncedGlossary[], terms: SyncedTerm[] = []): GlossarySnapshot {
  return { glossaries, terms }
}

function remoteDoc(snap: GlossarySnapshot): RemoteGlossaryRead {
  return {
    status: "ok",
    document: {
      schemaVersion: GLOSSARY_SYNC_SCHEMA_VERSION,
      glossaries: [...snap.glossaries],
      terms: [...snap.terms],
    },
    fileId: "file",
    modifiedTime: "2026-01-01T00:00:00.000Z",
  }
}

function firstSyncPrompt(plan: { prompts: Array<{ kind: string }> }) {
  const prompt = plan.prompts.find((entry) => entry.kind === "first-sync")
  return prompt?.kind === "first-sync" ? prompt : undefined
}

beforeEach(() => {
  state.local = snapshot([])
  state.base = null
  state.remote = { status: "absent" }
  state.email = EMAIL
})

describe("planGlossarySync — an absent remote", () => {
  it("uploads without asking on a device that has simply never synced", async () => {
    state.local = snapshot([glossary("g")], [term("g", "React")])

    const result = await planGlossarySync()

    expect(result.status).toBe("ready")
    if (result.status !== "ready") return
    expect(result.plan.prompts).toEqual([])
    expect(result.plan.remote).toBeNull()
    expect(result.plan.merge.terms).toHaveLength(1)
  })

  /**
   * The gap this test exists for. Reading the absent case before the account
   * check meant "sign out, sign in with the other account, press sync" silently
   * pushed everything this device holds into the new account's Drive — no
   * dialog, no count, nothing to cancel.
   */
  it("asks first when the account changed, even though the cloud is empty", async () => {
    state.local = snapshot([glossary("g")], [term("g", "React"), term("g", "Go")])
    state.base = { email: OTHER_EMAIL, snapshot: snapshot([glossary("g")]) }

    const result = await planGlossarySync()

    expect(result.status).toBe("ready")
    if (result.status !== "ready") return
    const prompt = firstSyncPrompt(result.plan)
    expect(prompt).toMatchObject({ accountChanged: true, email: EMAIL, incoming: 0, outgoing: 3 })
  })

  it("does nothing when there is nothing on either side", async () => {
    expect(await planGlossarySync()).toEqual({ status: "no-change" })
  })
})

describe("planGlossarySync — the account boundary", () => {
  /**
   * A base belonging to another account describes an agreement with a different
   * cloud. Using it would read that account's rows as this one's deletions, so
   * it must be dropped — the rows on both sides survive and the user is asked.
   */
  it("does not read the other account's rows as deletions", async () => {
    const mine = snapshot([glossary("mine")], [term("mine", "React")])
    state.local = mine
    state.base = { email: OTHER_EMAIL, snapshot: mine }
    state.remote = remoteDoc(snapshot([glossary("theirs")], [term("theirs", "Go")]))

    const result = await planGlossarySync()

    expect(result.status).toBe("ready")
    if (result.status !== "ready") return
    expect(result.plan.merge.stats.localRowsRemoved).toBe(0)
    expect(result.plan.merge.terms.map((row) => row.source).sort()).toEqual(["Go", "React"])
    expect(firstSyncPrompt(result.plan)).toMatchObject({ accountChanged: true, email: EMAIL })
  })

  it("uses the base normally once it belongs to the account in play", async () => {
    const base = snapshot([glossary("g")], [term("g", "React")])
    state.local = base
    state.base = { email: EMAIL, snapshot: base }
    // The other device deleted the term, and the base is what says so.
    state.remote = remoteDoc(snapshot([glossary("g")]))

    const result = await planGlossarySync()

    expect(result.status).toBe("ready")
    if (result.status !== "ready") return
    expect(firstSyncPrompt(result.plan)).toBeUndefined()
    expect(result.plan.merge.terms).toEqual([])
  })

  it("marks a device's very first sync as one, without calling it an account change", async () => {
    state.local = snapshot([glossary("g")], [term("g", "React")])
    state.remote = remoteDoc(snapshot([glossary("g")], [term("g", "Go")]))

    const result = await planGlossarySync()

    expect(result.status).toBe("ready")
    if (result.status !== "ready") return
    expect(firstSyncPrompt(result.plan)).toMatchObject({ accountChanged: false })
  })
})

describe("planGlossarySync — refusals and gates", () => {
  it("stops on a remote it cannot read, rather than treating it as empty", async () => {
    state.local = snapshot([glossary("g")], [term("g", "React")])
    state.base = { email: EMAIL, snapshot: state.local }
    state.remote = { status: "unreadable", reason: "version-too-new" }

    expect(await planGlossarySync()).toEqual({ status: "blocked", reason: "version-too-new" })
  })

  it("asks before a merge that would remove most of what this device holds", async () => {
    const terms = Array.from({ length: 10 }, (_, i) => term("g", `t${i}`))
    const base = snapshot([glossary("g")], terms)
    state.local = base
    state.base = { email: EMAIL, snapshot: base }
    // The other device deleted eight of the ten.
    state.remote = remoteDoc(snapshot([glossary("g")], terms.slice(0, 2)))

    const result = await planGlossarySync()

    expect(result.status).toBe("ready")
    if (result.status !== "ready") return
    expect(result.plan.prompts).toContainEqual({ kind: "destructive", removing: 8, total: 11 })
  })
})

describe("planGlossarySync — a first sync that moves nothing", () => {
  /**
   * A device set up from the same exported file already agrees with the cloud,
   * so every statistic is zero. Returning "no change" there left the base unset
   * — and a device with no base treats its NEXT sync as a first sync too, which
   * reads a term the user has since deleted as one arriving from the cloud and
   * puts it back.
   */
  it("is still committed, because committing is what records the base", async () => {
    const rows = snapshot([glossary("g")], [term("g", "token")])
    state.local = rows
    state.remote = remoteDoc(rows)
    state.base = null

    const result = await planGlossarySync()

    expect(result.status).toBe("ready")
  })

  it("asks the user nothing, because nothing is happening", async () => {
    const rows = snapshot([glossary("g")], [term("g", "token")])
    state.local = rows
    state.remote = remoteDoc(rows)
    state.base = null

    const result = await planGlossarySync()

    if (result.status !== "ready") throw new Error("expected a plan")
    expect(result.plan.prompts).toEqual([])
  })

  /** Once a base exists, an unchanged sync has nothing left to record. */
  it("reports no change once the base is already there", async () => {
    const rows = snapshot([glossary("g")], [term("g", "token")])
    state.local = rows
    state.remote = remoteDoc(rows)
    state.base = { email: EMAIL, snapshot: rows }

    expect((await planGlossarySync()).status).toBe("no-change")
  })

  /**
   * The deletion this exists to protect: with the base recorded by the first
   * sync, removing a term locally reads as a local deletion to propagate rather
   * than as a cloud row arriving.
   */
  it("lets a later local deletion propagate instead of being resurrected", async () => {
    const withTerm = snapshot([glossary("g")], [term("g", "token")])
    state.base = { email: EMAIL, snapshot: withTerm }
    state.remote = remoteDoc(withTerm)
    state.local = snapshot([glossary("g")], [])

    const result = await planGlossarySync()

    if (result.status !== "ready") throw new Error("expected a plan")
    expect(result.plan.merge.terms).toEqual([])
  })
})

describe("planGlossarySync — held to the account the click was made under", () => {
  /**
   * The glossary half can run long after the click, once the config conflict
   * dialog closes. It cannot reuse that click's token — the dialog can sit open
   * past its expiry — but it must still be held to the ACCOUNT, or a fresh
   * token silently binds it to whoever another tab has since switched to.
   */
  it("refuses when the signed-in account is no longer the one that was clicked", async () => {
    state.local = snapshot([glossary("g")], [term("g", "token")])
    state.remote = { status: "absent" }
    state.email = "b@example.com"

    const result = await planGlossarySync({ expectedEmail: "a@example.com" })

    expect(result).toEqual({ status: "blocked", reason: "account-changed" })
  })

  it("proceeds when it is still the same account", async () => {
    state.local = snapshot([glossary("g")], [term("g", "token")])
    state.remote = { status: "absent" }
    state.email = EMAIL

    expect((await planGlossarySync({ expectedEmail: EMAIL })).status).toBe("ready")
  })

  /** An immediate sync names no expectation; it IS the click. */
  it("does not second-guess a sync that passes no account", async () => {
    state.local = snapshot([glossary("g")], [term("g", "token")])
    state.remote = { status: "absent" }
    state.email = "anyone@example.com"

    expect((await planGlossarySync()).status).toBe("ready")
  })
})
