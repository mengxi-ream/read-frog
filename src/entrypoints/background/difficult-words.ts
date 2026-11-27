import type { VocabEvent, VocabJudgeInput, VocabLang, VocabSeen } from "@read-frog/api-contract"
import type { DifficultWordsAccess, DifficultWordsFailure } from "@/utils/difficult-words/types"
import { ORPCError } from "@orpc/client"
import {
  VOCAB_JUDGE_MAX_EVENTS,
  VOCAB_JUDGE_MAX_LANGS,
  VOCAB_SEEN_MAX_WORDS,
} from "@read-frog/api-contract"
import { GATED_FEATURES } from "@read-frog/definitions"
import { browser, storage } from "#imports"
import { createLogger } from "@/utils/logging/logger"
import { onMessage, sendMessage } from "@/utils/message"
import { backgroundOrpcClient } from "@/utils/orpc/background-client"

// The server side of difficult words, for every tab: whether the account may
// use them, and the queue of what the reader did with marked words.
//
// The queue is kept in memory and in local storage, so a record made just
// before a tab closes, the browser quits or the service worker is torn down
// still reaches the server. Each record has its own id: one sent twice is
// stored once, so a request that may or may not have arrived is sent again.
//
// The marked words the reader saw go with the records, but only once: the
// server counts them and keeps nothing to tell a second sending by, so a
// request that fails is not sent again with them.

const log = createLogger("background/difficult-words")

const OUTBOX_KEY = "local:difficultWordsOutbox" as const
const ACCESS_CACHE_KEY = "session:difficultWordsAccess" as const

/**
 * Every page with the floating button asks, so the verdict is kept a while:
 * a change of account clears it, the popup asks afresh each time it opens,
 * and the judge's own refusal replaces it.
 */
const ACCESS_TTL_MS = 60 * 60_000
/** A card closing records its word and judges the paragraphs on screen right after: one request for both. */
const FLUSH_DELAY_MS = 300
/** After these, the records wait for the next request the pages make. */
const RETRY_DELAYS_MS = [2_000, 10_000, 60_000]
/** Seen words wait this long for a request a page makes, then go on their own. */
const SEEN_FLUSH_DELAY_MS = 5_000

export function toDifficultWordsFailure(error: unknown): DifficultWordsFailure {
  if (!(error instanceof ORPCError)) {
    // fetch itself threw: there is no connection.
    return { kind: "offline" }
  }
  const resetAt =
    typeof error.data === "object" &&
    error.data !== null &&
    typeof (error.data as { resetAt?: unknown }).resetAt === "string"
      ? (error.data as { resetAt: string }).resetAt
      : null
  switch (error.code) {
    case "UNAUTHORIZED":
      return { kind: "signedOut" }
    case "VOCAB_BETA_RESTRICTED":
      return { kind: "restricted" }
    case "VOCAB_DAILY_LIMIT_REACHED":
      return { kind: "dailyLimit", resetAt }
    case "VOCAB_RATE_LIMITED":
      return { kind: "rateLimited", resetAt }
    default:
      break
  }
  if (error.status === 401) return { kind: "signedOut" }
  if (error.status >= 500) return { kind: "offline" }
  return { kind: "error" }
}

/** Records the server will never take, whoever sends them: sending them again cannot help. */
function isUnsendable(failure: DifficultWordsFailure) {
  return failure.kind === "signedOut" || failure.kind === "restricted" || failure.kind === "error"
}

/**
 * The records still to be stored, oldest first, and the seen words still to
 * be sent.
 *
 * An undo goes in the same request as the record it takes back or a later
 * one, never while that record is on its way in another: the server acks an
 * undo of a record it has not stored yet and does nothing, and the record,
 * sent again, would then stand.
 *
 * One request names at most VOCAB_JUDGE_MAX_LANGS languages in its records
 * and seen words together; the rest go in the next one.
 */
export class DifficultWordsOutbox {
  private events: VocabEvent[] = []
  /** By language and version. */
  private readonly seen = new Map<string, { lang: VocabLang; v: number; words: Set<string> }>()
  private seenTimer: ReturnType<typeof setTimeout> | null = null
  private readonly inFlight = new Set<string>()
  /** Handed to a request at least once, or left from before: the server may have them. */
  private readonly attempted = new Set<string>()
  /** By record id: called once the request carrying it settles. */
  private readonly settleWaiters = new Map<string, Array<() => void>>()
  private loaded: Promise<void> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private retries = 0

  constructor(private readonly send: (input: VocabJudgeInput) => Promise<{ acked: string[] }>) {}

  private load() {
    this.loaded ??= storage
      .getItem<VocabEvent[]>(OUTBOX_KEY)
      .then((saved) => {
        if (!Array.isArray(saved)) return
        const known = new Set(this.events.map((event) => event.id))
        const left = saved.filter((event) => !known.has(event.id))
        // They may have gone out before the worker was torn down.
        for (const event of left) this.attempted.add(event.id)
        this.events = [...left, ...this.events]
        if (this.events.length > 0) this.schedule(FLUSH_DELAY_MS)
      })
      .catch((error) => {
        log.warn("Failed to read the record queue", { error })
      })
    return this.loaded
  }

  /** Starts the queue: records left from before are sent. */
  start() {
    void this.load()
  }

  private persist() {
    void storage.setItem(OUTBOX_KEY, this.events).catch((error) => {
      log.warn("Failed to save the record queue", { error })
    })
  }

  /** Queues records. An undo of a record no request has carried yet drops it instead: neither goes. */
  async add(events: VocabEvent[]) {
    await this.load()
    const known = new Set(this.events.map((event) => event.id))
    const added: VocabEvent[] = []
    let dropped = false
    for (const event of events) {
      if (known.has(event.id)) continue
      known.add(event.id)
      if (event.kind === "undo" && this.isUnsent(event.target)) {
        this.events = this.events.filter((other) => other.id !== event.target)
        dropped = true
        continue
      }
      added.push(event)
    }
    if (added.length === 0) {
      if (dropped) this.persist()
      return
    }
    this.events.push(...added)
    this.persist()
    this.retries = 0
    this.schedule(FLUSH_DELAY_MS)
  }

  private isUnsent(id: string) {
    return (
      !this.inFlight.has(id) &&
      !this.attempted.has(id) &&
      this.events.some((event) => event.id === id)
    )
  }

  /**
   * Waits until no record the undos among `events` take back is on its way,
   * so a request carrying them can judge with the undos counted.
   */
  async afterTargets(events: VocabEvent[]) {
    const waits: Promise<void>[] = []
    for (const event of events) {
      if (event.kind !== "undo" || !this.inFlight.has(event.target)) continue
      const target = event.target
      waits.push(
        new Promise((resolve) => {
          const waiters = this.settleWaiters.get(target)
          if (waiters) waiters.push(resolve)
          else this.settleWaiters.set(target, [resolve])
        }),
      )
    }
    await Promise.all(waits)
  }

  /** The oldest records not already on their way, marked as on their way. */
  async take(): Promise<VocabEvent[]> {
    await this.load()
    const queued = new Set(this.events.map((event) => event.id))
    const taken: VocabEvent[] = []
    const takenIds = new Set<string>()
    const langs = new Set<VocabLang>()
    for (const event of this.events) {
      if (taken.length >= VOCAB_JUDGE_MAX_EVENTS) break
      if (this.inFlight.has(event.id)) continue
      // Its record is on its way in another request: the undo waits for it.
      if (event.kind === "undo" && queued.has(event.target) && !takenIds.has(event.target)) continue
      // A language past the limit waits for the next request, its own records still in order.
      if (!langs.has(event.lang) && langs.size >= VOCAB_JUDGE_MAX_LANGS) continue
      langs.add(event.lang)
      taken.push(event)
      takenIds.add(event.id)
    }
    for (const event of taken) {
      this.inFlight.add(event.id)
      this.attempted.add(event.id)
    }
    if (taken.length > 0 && this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    return taken
  }

  /** After a request that carried `sent`: the stored ones leave the queue. */
  settle(sent: VocabEvent[], result: { acked: string[] } | { failure: DifficultWordsFailure }) {
    for (const event of sent) this.inFlight.delete(event.id)
    if (sent.length === 0) return
    const drop =
      "acked" in result
        ? new Set(result.acked)
        : isUnsendable(result.failure)
          ? new Set(sent.map((event) => event.id))
          : new Set<string>()
    if (drop.size > 0) {
      this.events = this.events.filter((event) => !drop.has(event.id))
      for (const id of drop) this.attempted.delete(id)
      this.persist()
    }
    // The requests waiting on these go on once this returns, with the queue as it is now.
    for (const event of sent) {
      for (const resolve of this.settleWaiters.get(event.id) ?? []) resolve()
      this.settleWaiters.delete(event.id)
    }
    // Sent and still queued, a failure or a record the server did not take:
    // tried again a little later, a few times, never straight away.
    if (sent.some((event) => !drop.has(event.id))) {
      const delay = RETRY_DELAYS_MS[this.retries]
      this.retries += 1
      if (delay !== undefined) this.schedule(delay)
      return
    }
    this.retries = 0
    // More than one request carries.
    if (this.events.some((event) => !this.inFlight.has(event.id))) this.schedule(0)
  }

  /**
   * Drops every record and seen word not stored yet: the account changed,
   * and they say nothing about the new one. A request already on its way
   * went as the account that made them.
   */
  async clear() {
    await this.load()
    this.events = []
    this.attempted.clear()
    this.seen.clear()
    this.retries = 0
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.seenTimer) clearTimeout(this.seenTimer)
    this.seenTimer = null
    this.persist()
  }

  /** Queues marked words the reader saw, to go with the next request. */
  addSeen(groups: VocabSeen[]) {
    for (const { lang, v, words } of groups) {
      const key = `${lang}\u0000${v}`
      let group = this.seen.get(key)
      if (!group) {
        group = { lang, v, words: new Set() }
        this.seen.set(key, group)
      }
      for (const word of words) group.words.add(word)
    }
    if (this.seen.size > 0 && !this.seenTimer) this.scheduleSeen(SEEN_FLUSH_DELAY_MS)
  }

  /**
   * The seen words a request carrying `events` can take too, taken out for
   * good: at most VOCAB_SEEN_MAX_WORDS, in the languages the records name or
   * in others up to VOCAB_JUDGE_MAX_LANGS in all.
   */
  takeSeen(events: VocabEvent[]): VocabSeen[] {
    const langs = new Set<VocabLang>(events.map((event) => event.lang))
    const taken: VocabSeen[] = []
    let room = VOCAB_SEEN_MAX_WORDS
    for (const [key, group] of this.seen) {
      if (room === 0) break
      if (!langs.has(group.lang)) {
        if (langs.size >= VOCAB_JUDGE_MAX_LANGS) continue
        langs.add(group.lang)
      }
      const words = [...group.words].slice(0, room)
      for (const word of words) group.words.delete(word)
      if (group.words.size === 0) this.seen.delete(key)
      taken.push({ lang: group.lang, v: group.v, words })
      room -= words.length
    }
    return taken
  }

  /**
   * After a request: seen words it had no room for go straight after one
   * that went through, and a while after one that failed.
   */
  settleSeen(ok: boolean) {
    if (this.seen.size === 0) {
      if (this.seenTimer) clearTimeout(this.seenTimer)
      this.seenTimer = null
      return
    }
    if (ok) this.scheduleSeen(0)
    else if (!this.seenTimer) this.scheduleSeen(SEEN_FLUSH_DELAY_MS)
  }

  private scheduleSeen(delay: number) {
    if (this.seenTimer) clearTimeout(this.seenTimer)
    this.seenTimer = setTimeout(() => {
      this.seenTimer = null
      void this.flush()
    }, delay)
  }

  private schedule(delay: number) {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, delay)
  }

  /** Sends the queue on its own, when no page request came to carry it. */
  async flush() {
    const events = await this.take()
    const seen = this.takeSeen(events)
    if (events.length === 0 && seen.length === 0) return
    try {
      const output = await this.send({
        ...(events.length > 0 && { events }),
        ...(seen.length > 0 && { seen }),
      })
      this.settle(events, { acked: output.acked })
      this.settleSeen(true)
    } catch (error) {
      const failure = toDifficultWordsFailure(error)
      log.warn("Failed to send records", { failure: failure.kind })
      this.settle(events, { failure })
      this.settleSeen(false)
    }
  }
}

interface CachedAccess {
  access: Exclude<DifficultWordsAccess, "unknown">
  cachedAt: number
}

let accessInflight: Promise<DifficultWordsAccess> | null = null
let activeOutbox: DifficultWordsOutbox | null = null

/**
 * Drops the records not sent yet: the auth cookie changed, so the account
 * may have, and the server would count them for whoever is signed in now.
 */
export async function clearDifficultWordsOutbox(): Promise<void> {
  await activeOutbox?.clear()
}

/** Drops the verdict: the auth cookie changed, so the account may have. */
export async function clearDifficultWordsAccessCache(): Promise<void> {
  try {
    await storage.removeItem(ACCESS_CACHE_KEY)
  } catch (error) {
    log.warn("Failed to clear the access cache", { error })
  }
}

async function readCachedAccess(): Promise<DifficultWordsAccess | null> {
  try {
    const cached = await storage.getItem<CachedAccess>(ACCESS_CACHE_KEY)
    return cached && Date.now() - cached.cachedAt <= ACCESS_TTL_MS ? cached.access : null
  } catch {
    return null
  }
}

function fetchAccess(): Promise<DifficultWordsAccess> {
  accessInflight ??= backgroundOrpcClient.featureAccess
    .status({ featureKey: GATED_FEATURES.difficult_words })
    .then((status): DifficultWordsAccess => (status.allowed ? "allowed" : "denied"))
    .catch((error): DifficultWordsAccess => {
      if (error instanceof ORPCError && (error.code === "UNAUTHORIZED" || error.status === 401)) {
        return "signedOut"
      }
      // The server no longer knows the key: the feature left the gated list
      // when it opened to everyone.
      if (error instanceof ORPCError && error.code === "BAD_REQUEST") return "allowed"
      log.warn("Access check failed", { error })
      return "unknown"
    })
    .then(async (access) => {
      if (access !== "unknown") await cacheAccess(access)
      return access
    })
    .finally(() => {
      accessInflight = null
    })
  return accessInflight
}

async function cacheAccess(access: Exclude<DifficultWordsAccess, "unknown">) {
  await storage
    .setItem<CachedAccess>(ACCESS_CACHE_KEY, { access, cachedAt: Date.now() })
    .catch(() => {})
}

export function setupDifficultWordsHandlers() {
  const outbox = new DifficultWordsOutbox((input) => backgroundOrpcClient.vocab.judge(input))
  activeOutbox = outbox
  outbox.start()

  onMessage("getDifficultWordsAccess", async (message) => {
    if (message.data?.fresh) return await fetchAccess()
    return (await readCachedAccess()) ?? (await fetchAccess())
  })

  onMessage("judgeDifficultWords", async (message) => {
    const { own, blocks, events: newEvents } = message.data
    if (newEvents?.length) {
      await outbox.add(newEvents)
      await outbox.afterTargets(newEvents)
    }
    const events = await outbox.take()
    const seen = outbox.takeSeen(events)
    try {
      const output = await backgroundOrpcClient.vocab.judge({
        ...(own ? { own } : {}),
        ...(events.length > 0 ? { events } : {}),
        ...(seen.length > 0 ? { seen } : {}),
        blocks,
      })
      outbox.settle(events, { acked: output.acked })
      outbox.settleSeen(true)
      return { ok: true as const, output }
    } catch (error) {
      const failure = toDifficultWordsFailure(error)
      outbox.settle(events, { failure })
      outbox.settleSeen(false)
      // The judge is the fresher verdict: the controls that ask for access hide with it.
      if (failure.kind === "signedOut") await cacheAccess("signedOut")
      else if (failure.kind === "restricted") await cacheAccess("denied")
      return { ok: false as const, failure }
    }
  })

  onMessage("recordDifficultWordEvents", async (message) => {
    await outbox.add(message.data.events)
  })

  onMessage("recordDifficultWordsSeen", (message) => {
    outbox.addSeen(message.data.seen)
  })

  // A word the reader knows is unmarked in every open page, not just this one.
  onMessage("broadcastDifficultWordLemma", async (message) => {
    const senderTabId = message.sender?.tab?.id
    // Every page the content runtime runs in, local files included.
    const tabs = await browser.tabs.query({ url: ["http://*/*", "https://*/*", "file:///*"] })
    for (const tab of tabs) {
      if (tab.id === undefined || tab.id === senderTabId) continue
      void sendMessage("difficultWordLemmaChanged", message.data, {
        tabId: tab.id,
        frameId: 0,
      }).catch(() => {})
    }
  })
}
