import type { VocabEvent, VocabJudgeInput, VocabLang, VocabSeen } from "@read-frog/api-contract"
import { ORPCError } from "@orpc/client"
import {
  VOCAB_JUDGE_MAX_EVENTS,
  VOCAB_JUDGE_MAX_LANGS,
  VOCAB_SEEN_MAX_WORDS,
} from "@read-frog/api-contract"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { browser, storage } from "#imports"

const statusMock = vi.fn<(...args: any[]) => any>()
const judgeMock = vi.fn<(...args: any[]) => any>()
const sendMessageMock = vi.fn<(...args: any[]) => Promise<unknown>>(() => Promise.resolve())
type Handler = (message: { data?: unknown; sender?: unknown }) => Promise<unknown>
const handlers = new Map<string, Handler>()

vi.mock("@/utils/orpc/background-client", () => ({
  backgroundOrpcClient: {
    featureAccess: { status: (...args: any[]) => statusMock(...args) },
    vocab: { judge: (...args: any[]) => judgeMock(...args) },
  },
}))

vi.mock("@/utils/message", () => ({
  onMessage: (key: string, handler: Handler) => {
    handlers.set(key, handler)
  },
  sendMessage: (...args: any[]) => sendMessageMock(...args),
}))

const {
  DifficultWordsOutbox,
  clearDifficultWordsAccessCache,
  setupDifficultWordsHandlers,
  toDifficultWordsFailure,
} = await import("../difficult-words")

const OUTBOX_KEY = "local:difficultWordsOutbox"
const ACCESS_TTL_MS = 60 * 60_000

/** Stands in for extension storage, cloning as it does. */
const store = new Map<string, unknown>()

let nextEvent = 0
function event(word = "ubiquitous", lang: VocabLang = "en"): VocabEvent {
  nextEvent += 1
  return {
    id: `0190f5c6-2d0c-7000-8000-${String(nextEvent).padStart(12, "0")}`,
    lang,
    kind: "known",
    word,
    at: "2026-11-03T00:00:00.000Z",
  }
}

/** Marked words seen in `lang`, marked under version 1. */
function seenIn(lang: VocabLang, ...words: string[]): VocabSeen {
  return { lang, v: 1, words }
}

function undoOf(record: VocabEvent): VocabEvent {
  nextEvent += 1
  return {
    id: `0190f5c6-2d0c-7000-8000-${String(nextEvent).padStart(12, "0")}`,
    lang: record.lang,
    kind: "undo",
    target: record.id,
    at: "2026-11-03T00:00:01.000Z",
  }
}

type Send = (input: VocabJudgeInput) => Promise<{ acked: string[] }>

function ackAll(input: VocabJudgeInput) {
  return Promise.resolve({ acked: (input.events ?? []).map((entry) => entry.id) })
}

function ask(type: string, data?: unknown, sender?: unknown) {
  const handler = handlers.get(type)
  if (!handler) throw new Error(`${type} handler was never registered`)
  return handler({ data, sender })
}

beforeEach(() => {
  vi.clearAllMocks()
  store.clear()
  storage.getItem = async (key: string) => (store.has(key) ? structuredClone(store.get(key)) : null)
  storage.setItem = async (key: string, value: unknown) => {
    store.set(key, structuredClone(value))
  }
  storage.removeItem = async (key: string) => {
    store.delete(key)
  }
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("toDifficultWordsFailure", () => {
  it("reads what the page acts on from the error", () => {
    const resetAt = "2026-11-04T00:00:00.000Z"

    expect(toDifficultWordsFailure(new TypeError("Failed to fetch"))).toEqual({ kind: "offline" })
    expect(toDifficultWordsFailure(new ORPCError("UNAUTHORIZED"))).toEqual({ kind: "signedOut" })
    expect(
      toDifficultWordsFailure(new ORPCError("VOCAB_BETA_RESTRICTED", { status: 403 })),
    ).toEqual({
      kind: "restricted",
    })
    expect(
      toDifficultWordsFailure(
        new ORPCError("VOCAB_DAILY_LIMIT_REACHED", { status: 429, data: { limit: 50, resetAt } }),
      ),
    ).toEqual({ kind: "dailyLimit", resetAt })
    expect(toDifficultWordsFailure(new ORPCError("VOCAB_RATE_LIMITED", { status: 429 }))).toEqual({
      kind: "rateLimited",
      resetAt: null,
    })
    expect(toDifficultWordsFailure(new ORPCError("SOMETHING", { status: 401 }))).toEqual({
      kind: "signedOut",
    })
    expect(toDifficultWordsFailure(new ORPCError("INTERNAL_SERVER_ERROR"))).toEqual({
      kind: "offline",
    })
    expect(toDifficultWordsFailure(new ORPCError("BAD_REQUEST"))).toEqual({ kind: "error" })
  })
})

describe("DifficultWordsOutbox", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it("sends a record a moment after it is made, once, and forgets it when stored", async () => {
    const send = vi.fn<Send>(ackAll)
    const outbox = new DifficultWordsOutbox(send)
    const record = event()

    await outbox.add([record, record])
    await outbox.add([record])
    expect(store.get(OUTBOX_KEY)).toEqual([record])
    await vi.advanceTimersByTimeAsync(299)
    expect(send).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)

    expect(send).toHaveBeenCalledWith({ events: [record] })
    expect(store.get(OUTBOX_KEY)).toEqual([])
  })

  it("sends the records left from before it started", async () => {
    const saved = [event()]
    store.set(OUTBOX_KEY, saved)
    const send = vi.fn<Send>(ackAll)

    new DifficultWordsOutbox(send).start()
    await vi.advanceTimersByTimeAsync(300)

    expect(send).toHaveBeenCalledWith({ events: saved })
    expect(store.get(OUTBOX_KEY)).toEqual([])
  })

  it("drops an undo and its record together while no request has carried the record", async () => {
    const send = vi.fn<Send>(ackAll)
    const outbox = new DifficultWordsOutbox(send)
    const record = event()
    await outbox.add([record])

    await outbox.add([undoOf(record)])
    await vi.advanceTimersByTimeAsync(300)

    expect(send).not.toHaveBeenCalled()
    expect(store.get(OUTBOX_KEY)).toEqual([])
  })

  it("holds an undo while its record is on its way, and sends it once the record is stored", async () => {
    const send = vi.fn<Send>(ackAll)
    const outbox = new DifficultWordsOutbox(send)
    const record = event()
    await outbox.add([record])
    // A page's request carries it.
    const carried = await outbox.take()
    const undo = undoOf(record)

    await outbox.add([undo])
    await vi.advanceTimersByTimeAsync(300)
    expect(send).not.toHaveBeenCalled()

    outbox.settle(carried, { acked: [record.id] })
    await vi.advanceTimersByTimeAsync(0)

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith({ events: [undo] })
    expect(store.get(OUTBOX_KEY)).toEqual([])
  })

  it("sends an undo after its record when the request that carried the record failed", async () => {
    const send = vi.fn<Send>(ackAll)
    const outbox = new DifficultWordsOutbox(send)
    const record = event()
    await outbox.add([record])
    // It may have been stored all the same.
    outbox.settle(await outbox.take(), { failure: { kind: "offline" } })
    const undo = undoOf(record)

    await outbox.add([undo])
    await vi.advanceTimersByTimeAsync(300)

    expect(send).toHaveBeenCalledWith({ events: [record, undo] })
  })

  it("takes back with an undo a record left from before, which may have gone out", async () => {
    const record = event()
    store.set(OUTBOX_KEY, [record])
    const send = vi.fn<Send>(ackAll)
    const outbox = new DifficultWordsOutbox(send)
    const undo = undoOf(record)

    await outbox.add([undo])
    await vi.advanceTimersByTimeAsync(300)

    expect(send).toHaveBeenCalledWith({ events: [record, undo] })
  })

  it("hands out at most a request's worth of records, none twice", async () => {
    const outbox = new DifficultWordsOutbox(vi.fn<Send>(ackAll))
    const records = Array.from({ length: VOCAB_JUDGE_MAX_EVENTS + 5 }, () => event())
    await outbox.add(records)

    expect(await outbox.take()).toEqual(records.slice(0, VOCAB_JUDGE_MAX_EVENTS))
    expect(await outbox.take()).toEqual(records.slice(VOCAB_JUDGE_MAX_EVENTS))
    expect(await outbox.take()).toEqual([])
  })

  it("sends the rest straight after a full request", async () => {
    const send = vi.fn<Send>(ackAll)
    const outbox = new DifficultWordsOutbox(send)
    const records = Array.from({ length: VOCAB_JUDGE_MAX_EVENTS + 5 }, () => event())
    await outbox.add(records)

    await vi.advanceTimersByTimeAsync(301)

    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[1]![0].events).toEqual(records.slice(VOCAB_JUDGE_MAX_EVENTS))
    expect(store.get(OUTBOX_KEY)).toEqual([])
  })

  it("tries again a few times after a failure, waiting longer each time, then waits for a page's request", async () => {
    const send = vi.fn<Send>(async () => {
      throw new TypeError("Failed to fetch")
    })
    const outbox = new DifficultWordsOutbox(send)
    await outbox.add([event()])

    await vi.advanceTimersByTimeAsync(300)
    expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(send).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(send).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(send).toHaveBeenCalledTimes(4)
    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect(send).toHaveBeenCalledTimes(4)
    expect(store.get(OUTBOX_KEY)).toHaveLength(1)
  })

  it("does not send again straight away a record the server did not take", async () => {
    const send = vi.fn<Send>(async () => ({ acked: [] }))
    const outbox = new DifficultWordsOutbox(send)
    await outbox.add([event()])

    await vi.advanceTimersByTimeAsync(300)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it("drops what the server will never take", async () => {
    const send = vi.fn<Send>(async () => {
      throw new ORPCError("UNAUTHORIZED")
    })
    const outbox = new DifficultWordsOutbox(send)
    await outbox.add([event()])

    await vi.advanceTimersByTimeAsync(300)
    await vi.advanceTimersByTimeAsync(60_000)

    expect(send).toHaveBeenCalledTimes(1)
    expect(store.get(OUTBOX_KEY)).toEqual([])
  })

  describe("the words seen", () => {
    it("go with the next records, once", async () => {
      const send = vi.fn<Send>(ackAll)
      const outbox = new DifficultWordsOutbox(send)
      const record = event()

      outbox.addSeen([seenIn("en", "ubiquitous"), seenIn("en", "mat", "ubiquitous")])
      await outbox.add([record])
      await vi.advanceTimersByTimeAsync(300)

      expect(send).toHaveBeenCalledTimes(1)
      expect(send).toHaveBeenCalledWith({
        events: [record],
        seen: [seenIn("en", "ubiquitous", "mat")],
      })
      await vi.advanceTimersByTimeAsync(60_000)
      expect(send).toHaveBeenCalledTimes(1)
    })

    it("go on their own a few seconds after, by language and version", async () => {
      const send = vi.fn<Send>(ackAll)
      const outbox = new DifficultWordsOutbox(send)

      outbox.addSeen([seenIn("en", "ubiquitous"), { lang: "en", v: 2, words: ["mat"] }])
      await vi.advanceTimersByTimeAsync(4_999)
      expect(send).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)

      expect(send).toHaveBeenCalledWith({
        seen: [seenIn("en", "ubiquitous"), { lang: "en", v: 2, words: ["mat"] }],
      })
    })

    it("are not sent again when the request carrying them failed", async () => {
      const send = vi.fn<Send>(async () => {
        throw new TypeError("Failed to fetch")
      })
      const outbox = new DifficultWordsOutbox(send)
      const record = event()

      outbox.addSeen([seenIn("en", "ubiquitous")])
      await outbox.add([record])
      await vi.advanceTimersByTimeAsync(300)
      expect(send).toHaveBeenLastCalledWith({
        events: [record],
        seen: [seenIn("en", "ubiquitous")],
      })

      // The record is tried again; the words seen are not.
      await vi.advanceTimersByTimeAsync(2_000)
      expect(send).toHaveBeenCalledTimes(2)
      expect(send).toHaveBeenLastCalledWith({ events: [record] })
    })

    it(`go ${VOCAB_SEEN_MAX_WORDS} a request at most, the rest straight after`, async () => {
      const send = vi.fn<Send>(ackAll)
      const outbox = new DifficultWordsOutbox(send)
      const words = Array.from({ length: VOCAB_SEEN_MAX_WORDS + 5 }, (_, index) => `word${index}`)

      outbox.addSeen([seenIn("en", ...words)])
      await vi.advanceTimersByTimeAsync(5_001)

      expect(send).toHaveBeenCalledTimes(2)
      expect(send.mock.calls[0]![0].seen).toEqual([
        seenIn("en", ...words.slice(0, VOCAB_SEEN_MAX_WORDS)),
      ])
      expect(send.mock.calls[1]![0].seen).toEqual([
        seenIn("en", ...words.slice(VOCAB_SEEN_MAX_WORDS)),
      ])
    })

    it(`share a request's ${VOCAB_JUDGE_MAX_LANGS} languages with the records, the others going next`, async () => {
      const send = vi.fn<Send>(ackAll)
      const outbox = new DifficultWordsOutbox(send)
      const records = [event("cat", "en"), event("chat", "fr"), event("Katze", "de")]

      outbox.addSeen([seenIn("fr", "omniprésent"), seenIn("es", "gato"), seenIn("it", "gatto")])
      await outbox.add(records)
      await vi.advanceTimersByTimeAsync(301)

      expect(send).toHaveBeenCalledTimes(2)
      expect(send.mock.calls[0]![0]).toEqual({
        events: records,
        seen: [seenIn("fr", "omniprésent"), seenIn("es", "gato")],
      })
      expect(send.mock.calls[1]![0]).toEqual({ seen: [seenIn("it", "gatto")] })
    })

    it(`hands out records in ${VOCAB_JUDGE_MAX_LANGS} languages at most, the others still in order`, async () => {
      const outbox = new DifficultWordsOutbox(vi.fn<Send>(ackAll))
      const langs: VocabLang[] = ["en", "fr", "de", "es", "it"]
      const records = langs.map((lang) => event("word", lang))
      const later = event("other", "en")
      await outbox.add([...records, later])

      expect(await outbox.take()).toEqual([...records.slice(0, 4), later])
      expect(await outbox.take()).toEqual([records[4]])
    })
  })
})

describe("difficult words handlers", () => {
  beforeEach(() => {
    setupDifficultWordsHandlers()
  })

  describe("getDifficultWordsAccess", () => {
    it("asks the server once, then answers from the cache until it ages out", async () => {
      const start = Date.now()
      const now = vi.spyOn(Date, "now").mockReturnValue(start)
      statusMock.mockResolvedValue({ allowed: true })

      await expect(ask("getDifficultWordsAccess")).resolves.toBe("allowed")
      statusMock.mockResolvedValue({ allowed: false })
      now.mockReturnValue(start + ACCESS_TTL_MS)
      await expect(ask("getDifficultWordsAccess")).resolves.toBe("allowed")
      expect(statusMock).toHaveBeenCalledTimes(1)

      now.mockReturnValue(start + ACCESS_TTL_MS + 1)
      await expect(ask("getDifficultWordsAccess")).resolves.toBe("denied")
      expect(statusMock).toHaveBeenCalledTimes(2)
      expect(statusMock).toHaveBeenCalledWith({ featureKey: "difficult_words" })
    })

    it("asks afresh when told to, and after the account may have changed", async () => {
      statusMock.mockResolvedValue({ allowed: true })
      await ask("getDifficultWordsAccess")

      await ask("getDifficultWordsAccess", { fresh: true })
      expect(statusMock).toHaveBeenCalledTimes(2)

      await clearDifficultWordsAccessCache()
      await ask("getDifficultWordsAccess")
      expect(statusMock).toHaveBeenCalledTimes(3)
    })

    it("tells a signed-out reader from a failed check, and keeps only the verdicts", async () => {
      statusMock.mockRejectedValueOnce(new ORPCError("UNAUTHORIZED"))
      await expect(ask("getDifficultWordsAccess")).resolves.toBe("signedOut")
      await expect(ask("getDifficultWordsAccess")).resolves.toBe("signedOut")
      expect(statusMock).toHaveBeenCalledTimes(1)

      await clearDifficultWordsAccessCache()
      statusMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))
      await expect(ask("getDifficultWordsAccess")).resolves.toBe("unknown")
      statusMock.mockResolvedValueOnce({ allowed: true })
      await expect(ask("getDifficultWordsAccess")).resolves.toBe("allowed")
      expect(statusMock).toHaveBeenCalledTimes(3)
    })

    it("counts the feature as open once the server no longer gates it", async () => {
      statusMock.mockRejectedValueOnce(new ORPCError("BAD_REQUEST"))

      await expect(ask("getDifficultWordsAccess")).resolves.toBe("allowed")
    })

    it("asks the server once for pages asking together", async () => {
      let answer!: (status: { allowed: boolean }) => void
      statusMock.mockReturnValue(
        new Promise((resolve) => {
          answer = resolve
        }),
      )

      const asks = Promise.all([
        ask("getDifficultWordsAccess"),
        ask("getDifficultWordsAccess", { fresh: true }),
      ])
      // Both are waiting on the one request.
      await new Promise((resolve) => setTimeout(resolve, 0))
      answer({ allowed: true })

      await expect(asks).resolves.toEqual(["allowed", "allowed"])
      expect(statusMock).toHaveBeenCalledTimes(1)
    })
  })

  describe("judgeDifficultWords", () => {
    const blocks = [{ id: "b1", text: "The ubiquitous cat." }]
    const output = {
      acked: [] as string[],
      blocks: [{ id: "b1", lang: "en", v: 1, hard: [] }],
      needsLevel: [],
    }

    it("carries the queued records with the paragraphs, and drops them once stored", async () => {
      const record = event()
      judgeMock.mockImplementation(async (input: VocabJudgeInput) => ({
        ...output,
        acked: input.events?.map((entry) => entry.id) ?? [],
      }))

      const response = await ask("judgeDifficultWords", {
        own: "zh-Hans",
        blocks,
        events: [record],
      })

      expect(judgeMock).toHaveBeenCalledWith({ own: "zh-Hans", events: [record], blocks })
      expect(response).toEqual({ ok: true, output: { ...output, acked: [record.id] } })
      expect(store.get(OUTBOX_KEY)).toEqual([])
    })

    it("judges with an undo only once the request carrying its record has settled", async () => {
      const record = event()
      const undo = undoOf(record)
      let release!: () => void
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      judgeMock.mockImplementation(async (input: VocabJudgeInput) => {
        if (judgeMock.mock.calls.length === 1) await held
        return { ...output, acked: input.events?.map((entry) => entry.id) ?? [] }
      })

      const first = ask("judgeDifficultWords", { blocks, events: [record] })
      await vi.waitFor(() => expect(judgeMock).toHaveBeenCalledTimes(1))
      const second = ask("judgeDifficultWords", { blocks, events: [undo] })
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(judgeMock).toHaveBeenCalledTimes(1)

      release()
      await Promise.all([first, second])

      expect(judgeMock).toHaveBeenCalledTimes(2)
      expect(judgeMock.mock.calls[1]![0]).toEqual({ events: [undo], blocks })
      expect(store.get(OUTBOX_KEY)).toEqual([])
    })

    it("carries the words seen a page sent, once", async () => {
      judgeMock.mockResolvedValue(output)
      const seen = [seenIn("en", "ubiquitous")]

      await ask("recordDifficultWordsSeen", { seen })
      await ask("judgeDifficultWords", { own: "zh-Hans", blocks })
      await ask("judgeDifficultWords", { own: "zh-Hans", blocks })

      expect(judgeMock).toHaveBeenCalledTimes(2)
      expect(judgeMock.mock.calls[0]![0]).toEqual({ own: "zh-Hans", seen, blocks })
      expect(judgeMock.mock.calls[1]![0]).toEqual({ own: "zh-Hans", blocks })
    })

    it("answers a failure the page can act on, and keeps the verdict it gives", async () => {
      judgeMock.mockRejectedValue(new ORPCError("VOCAB_BETA_RESTRICTED", { status: 403 }))

      await expect(ask("judgeDifficultWords", { blocks })).resolves.toEqual({
        ok: false,
        failure: { kind: "restricted" },
      })
      await expect(ask("getDifficultWordsAccess")).resolves.toBe("denied")
      expect(statusMock).not.toHaveBeenCalled()

      judgeMock.mockRejectedValue(new ORPCError("UNAUTHORIZED"))
      await ask("judgeDifficultWords", { blocks })
      await expect(ask("getDifficultWordsAccess")).resolves.toBe("signedOut")
      expect(statusMock).not.toHaveBeenCalled()
    })
  })

  it("tells the other open pages about a word the reader knows", async () => {
    vi.spyOn(browser.tabs, "query").mockResolvedValue([{ id: 1 }, { id: 2 }, {}] as any)
    const change = { lang: "en", lemma: "ubiquitous", known: true }

    await ask("broadcastDifficultWordLemma", change, { tab: { id: 1 } })

    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(sendMessageMock).toHaveBeenCalledWith("difficultWordLemmaChanged", change, {
      tabId: 2,
      frameId: 0,
    })
  })
})
