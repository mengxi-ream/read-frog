import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { GlossarySnapshot } from "../active-matcher"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { buildMatchKey } from "../match-key"

/**
 * The module keeps `cached`, `inFlight` and `generation` at module scope, and
 * every test here is about how those three interact across an interleaving. A
 * fresh instance per test is the only way to start from a known state.
 */
async function loadModule() {
  vi.resetModules()
  return await import("../active-matcher")
}

interface Gate {
  resolve: (snapshot: GlossarySnapshot) => void
  reject: (error: unknown) => void
}

interface LoaderCall extends Gate {
  url: string | undefined
  targetLang: LangCodeISO6393
}

/**
 * A loader whose every call hangs until the test resolves it by hand.
 *
 * The races under test are all "what happens BETWEEN the request and the rows
 * coming back", so the test has to own that window rather than hope a timer
 * lands on the right side of it.
 */
function gatedLoader() {
  const calls: LoaderCall[] = []
  const load = (url: string | undefined, targetLang: LangCodeISO6393) => {
    let resolve!: (snapshot: GlossarySnapshot) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<GlossarySnapshot>((res, rej) => {
      resolve = res
      reject = rej
    })
    calls.push({ url, targetLang, resolve, reject })
    return promise
  }
  return { calls, load }
}

function snapshot(
  revision: number,
  terms: Record<string, string>,
  scopeKey = "glossary-1",
): GlossarySnapshot {
  return {
    revision,
    scopeKey,
    entries: Object.entries(terms).map(([source, target]) => ({
      matchKey: buildMatchKey(source, false),
      source,
      target,
      caseSensitive: false,
    })),
  }
}

const TEXT = "We landed at Chort Bay before dawn."

beforeEach(() => {
  fakeBrowser.reset()
})

describe("getActiveGlossary — invalidation during an outstanding load", () => {
  it("serves a superseded load to its own caller without installing it", async () => {
    const { calls, load } = gatedLoader()
    const module = await loadModule()
    module.setGlossarySnapshotLoader(load)

    // Caller asks before the edit...
    const pending = module.resolveGlossaryTerms(TEXT, true, "cmn")
    expect(calls).toHaveLength(1)

    // ...the options page writes, `storage.watch` fires, and only THEN do the
    // pre-edit rows come back.
    module.invalidateActiveGlossaryMatcher()
    calls[0]!.resolve(snapshot(7, { "Chort Bay": "雀特湾" }))

    // (a) The caller that asked still gets a usable matcher — it neither hangs
    // nor throws — carrying the revision it was actually resolved against, so a
    // post-edit sibling can out-vote it in `mergeBatchGlossaryTerms`.
    const preEdit = await pending
    expect(preEdit.revision).toBe(7)
    expect(preEdit.terms).toEqual([
      { matchKey: "i:chort bay", source: "Chort Bay", target: "雀特湾", keepOriginal: false },
    ])

    // (b) But it was never installed: the next call re-asks instead of serving
    // the wording the user just replaced.
    const afterEdit = module.resolveGlossaryTerms(TEXT, true, "cmn")
    expect(calls).toHaveLength(2)
    calls[1]!.resolve(snapshot(8, { "Chort Bay": "乔特湾" }))
    await expect(afterEdit).resolves.toMatchObject({
      revision: 8,
      terms: [expect.objectContaining({ target: "乔特湾" })],
    })
  })

  it("does not let a caller arriving after the edit join the superseded load", async () => {
    const { calls, load } = gatedLoader()
    const module = await loadModule()
    module.setGlossarySnapshotLoader(load)

    // A load is outstanding when the edit lands — the window the generation
    // guard covers for the caller that started it.
    const before = module.resolveGlossaryTerms(TEXT, true, "cmn")
    expect(calls).toHaveLength(1)
    module.invalidateActiveGlossaryMatcher()

    // A SECOND caller now arrives, still inside that window (the snapshot can
    // hang for up to SNAPSHOT_TIMEOUT_MS). It must not be handed the in-flight
    // pre-edit load: it asked after the edit, so it is entitled to see it.
    const after = module.resolveGlossaryTerms(TEXT, true, "cmn")
    expect(calls).toHaveLength(2)

    calls[0]!.resolve(snapshot(7, { "Chort Bay": "雀特湾" }))
    calls[1]!.resolve(snapshot(8, { "Chort Bay": "乔特湾" }))

    await expect(before).resolves.toMatchObject({
      revision: 7,
      terms: [expect.objectContaining({ target: "雀特湾" })],
    })
    await expect(after).resolves.toMatchObject({
      revision: 8,
      terms: [expect.objectContaining({ target: "乔特湾" })],
    })
  })

  it("still caches a load that lands before any invalidation", async () => {
    const { calls, load } = gatedLoader()
    const module = await loadModule()
    module.setGlossarySnapshotLoader(load)

    const pending = module.resolveGlossaryTerms(TEXT, true, "cmn")
    calls[0]!.resolve(snapshot(7, { "Chort Bay": "雀特湾" }))
    await expect(pending).resolves.toMatchObject({ revision: 7 })

    // The whole point of the cache: a second paragraph costs no round trip.
    await expect(module.resolveGlossaryTerms(TEXT, true, "cmn")).resolves.toMatchObject({
      revision: 7,
      terms: [expect.objectContaining({ target: "雀特湾" })],
    })
    expect(calls).toHaveLength(1)
  })

  it("reloads on the next call when the invalidation follows a settled load", async () => {
    const { calls, load } = gatedLoader()
    const module = await loadModule()
    module.setGlossarySnapshotLoader(load)

    const pending = module.resolveGlossaryTerms(TEXT, true, "cmn")
    calls[0]!.resolve(snapshot(7, { "Chort Bay": "雀特湾" }))
    await pending

    // Benign ordering — resolve first, invalidate after — behaves exactly as it
    // did before the generation counter existed.
    module.invalidateActiveGlossaryMatcher()
    const afterEdit = module.resolveGlossaryTerms(TEXT, true, "cmn")
    expect(calls).toHaveLength(2)
    calls[1]!.resolve(snapshot(8, { "Chort Bay": "乔特湾" }))
    await expect(afterEdit).resolves.toMatchObject({
      revision: 8,
      terms: [expect.objectContaining({ target: "乔特湾" })],
    })
  })
})

describe("getActiveGlossary — concurrent loads", () => {
  it("gives each target language its own in-flight load", async () => {
    const { calls, load } = gatedLoader()
    const module = await loadModule()
    module.setGlossarySnapshotLoader(load)

    // Input translation resolves its own target language while the page is
    // being warmed for another; both loads are outstanding at once.
    const cmn = module.resolveGlossaryTerms(TEXT, true, "cmn")
    const jpn = module.resolveGlossaryTerms(TEXT, true, "jpn")

    expect(calls).toHaveLength(2)
    expect(calls.map((call) => call.targetLang)).toEqual(["cmn", "jpn"])
    expect(calls.map((call) => call.url)).toEqual([undefined, undefined])

    calls[0]!.resolve(snapshot(7, { "Chort Bay": "雀特湾" }))
    calls[1]!.resolve(snapshot(7, { "Chort Bay": "チョート湾" }))

    await expect(cmn).resolves.toMatchObject({
      terms: [expect.objectContaining({ target: "雀特湾" })],
    })
    await expect(jpn).resolves.toMatchObject({
      terms: [expect.objectContaining({ target: "チョート湾" })],
    })
  })

  it("coalesces concurrent callers that want the same language and url", async () => {
    const { calls, load } = gatedLoader()
    const module = await loadModule()
    module.setGlossarySnapshotLoader(load)

    const first = module.getActiveGlossaryMatcher("cmn")
    const second = module.getActiveGlossaryMatcher("cmn")
    expect(calls).toHaveLength(1)

    calls[0]!.resolve(snapshot(7, { "Chort Bay": "雀特湾" }))
    expect(await first).toBe(await second)
  })
})

describe("getActiveGlossary — a loader that throws synchronously", () => {
  it("fails soft and leaves no in-flight slot behind", async () => {
    const module = await loadModule()
    module.setGlossarySnapshotLoader(() => {
      // Before any await inside the load, so a `finally` placed in the async
      // body would run while `load` is still in its temporal dead zone.
      throw new Error("loader exploded synchronously")
    })

    await expect(module.resolveGlossaryTerms(TEXT, true, "cmn")).resolves.toEqual({
      terms: [],
      revision: 0,
    })

    // The slot was released, so the next call issues a fresh load rather than
    // re-serving the failure forever.
    const { calls, load } = gatedLoader()
    module.setGlossarySnapshotLoader(load)
    const retry = module.resolveGlossaryTerms(TEXT, true, "cmn")
    expect(calls).toHaveLength(1)
    calls[0]!.resolve(snapshot(7, { "Chort Bay": "雀特湾" }))
    await expect(retry).resolves.toMatchObject({
      revision: 7,
      terms: [expect.objectContaining({ target: "雀特湾" })],
    })
  })
})
