import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { GlossaryEntry, GlossaryMatcher, MatchedTerm } from "./types"
import { storage } from "#imports"
import { GLOSSARY_REVISION_KEY } from "../constants/glossary"
import { logger } from "../logger"
import { sendMessage } from "../message"
import { createGlossaryMatcher } from "./matcher"

export interface GlossarySnapshot {
  revision: number
  /**
   * Which glossaries the requested URL activates, as a stable string.
   *
   * Lets this side tell "the page moved but the same glossaries apply" from "a
   * different set applies now", so an in-page navigation costs one small message
   * instead of recompiling up to 20,000 terms.
   */
  scopeKey: string
  entries: GlossaryEntry[]
}

/**
 * Upper bound on waiting for the glossary before translating without it.
 *
 * Catching a rejection is not enough: an unanswered snapshot request never
 * settles, and the caller is on the path to a user-visible translation. A wedged
 * or absent background must cost a moment, not the whole translation.
 */
const SNAPSHOT_TIMEOUT_MS = 2000

interface CachedMatcher {
  /** The URL the snapshot was requested for; `undefined` where there is no page. */
  url: string | undefined
  /** Terms are stored per target language, so a compiled matcher is for one. */
  targetLang: LangCodeISO6393
  revision: number
  scopeKey: string
  matcher: GlossaryMatcher
}

let cached: CachedMatcher | null = null
let inFlight: Promise<ActiveGlossary> | null = null

/**
 * The compiled matcher together with the revision it was built from.
 *
 * They travel as a PAIR because a caller that stamps a request with the revision
 * has to stamp it with the revision of the terms it actually received. Reading
 * `cached.revision` afterwards could see a different one: an edit in the options
 * page nulls the cache between any two statements, and the whole point of the
 * stamp is to survive exactly that race (see `mergeBatchGlossaryTerms`).
 */
export interface ActiveGlossary {
  matcher: GlossaryMatcher
  revision: number
}

/**
 * How this context obtains the glossary.
 *
 * Defaults to asking the background, because that is what a CONTENT SCRIPT must
 * do: its `indexedDB` belongs to the host page's origin, so the extension's own
 * database is unreachable there.
 *
 * The background overrides this at startup with a direct Dexie read (it cannot
 * message itself). The override is INJECTED rather than imported behind a
 * context check, because content scripts are bundled as a single IIFE — a
 * `import("./repository")` here, even on a branch a content script never takes,
 * gets inlined and drags all of Dexie (~106 KB) into every page we run on.
 * Measured: it moved host.js from 2,797,947 to 2,904,171 bytes.
 */
let loadSnapshot: (
  url: string | undefined,
  targetLang: LangCodeISO6393,
) => Promise<GlossarySnapshot> = async (url, targetLang) =>
  await sendMessage("getGlossarySnapshot", { url, targetLang })

export function setGlossarySnapshotLoader(
  loader: (url: string | undefined, targetLang: LangCodeISO6393) => Promise<GlossarySnapshot>,
): void {
  loadSnapshot = loader
}

/**
 * The URL whose glossaries apply here.
 *
 * `undefined` in a worker, and in any context that is not a page — the
 * background resolving a prompt it was not handed terms for. A glossary scoped
 * to particular sites must not leak into those, which is what
 * `isGlossaryActiveForUrl` does with an absent URL.
 */
function currentDocumentUrl(): string | undefined {
  if (typeof document === "undefined" || typeof location === "undefined") return undefined
  return location.href
}

/**
 * The compiled matcher for this context, built at most once per glossary
 * revision and per set of applicable glossaries.
 *
 * In a content script this costs ONE message for the whole page, not one per
 * paragraph: the compiled matcher is cached at module level and every paragraph
 * matches against it locally. A per-paragraph round trip would put a message hop
 * on the hottest path in the product.
 *
 * A URL change — an in-page navigation on a site whose glossaries are scoped by
 * path — re-asks the background, but recompiles only if the revision or the set
 * of applicable glossaries actually moved.
 */
let revisionWatchStarted = false

/**
 * Drop the cached matcher whenever the glossary is written to.
 *
 * The cache is keyed on the page URL, so without this an edit made in the
 * options page would not reach a tab that is already open until it navigated.
 * The alternative — re-requesting the snapshot on every call — puts a message
 * hop on the hottest path in the product, once per paragraph.
 *
 * Started lazily on first use so every context that actually matches gets one
 * watcher, and a context that never matches pays nothing.
 */
function watchGlossaryRevision(): void {
  if (revisionWatchStarted) return
  revisionWatchStarted = true
  try {
    storage.watch<number>(GLOSSARY_REVISION_KEY, () => invalidateActiveGlossaryMatcher())
  } catch (error) {
    // Never worth failing a translation over: the matcher is still correct, it
    // just will not notice an edit until the page reloads.
    logger.warn("Could not watch the glossary revision", error)
  }
}

async function getActiveGlossary(targetLang: LangCodeISO6393): Promise<ActiveGlossary> {
  watchGlossaryRevision()
  const url = currentDocumentUrl()
  if (cached && cached.url === url && cached.targetLang === targetLang) {
    return { matcher: cached.matcher, revision: cached.revision }
  }
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const snapshot = await Promise.race([
        loadSnapshot(url, targetLang),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("glossary snapshot timed out")), SNAPSHOT_TIMEOUT_MS),
        ),
      ])
      if (
        cached?.revision !== snapshot.revision ||
        cached.scopeKey !== snapshot.scopeKey ||
        cached.targetLang !== targetLang
      ) {
        cached = {
          url,
          targetLang,
          revision: snapshot.revision,
          scopeKey: snapshot.scopeKey,
          matcher: createGlossaryMatcher(snapshot.entries),
        }
      } else {
        // Same glossaries, same revision, same language, new address: keep the
        // compiled matcher and just move the cache onto this URL.
        cached = { ...cached, url }
      }
      return { matcher: cached.matcher, revision: cached.revision }
    } catch (error) {
      // A glossary that cannot be loaded must never fail a translation; the
      // page simply translates without it.
      logger.warn("Failed to load glossary snapshot", error)
      // Revision 0 loses every conflict in `mergeBatchGlossaryTerms`, which is
      // exactly right: this context has no terms to contribute to one.
      return { matcher: createGlossaryMatcher([]), revision: 0 }
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

export async function getActiveGlossaryMatcher(
  targetLang: LangCodeISO6393,
): Promise<GlossaryMatcher> {
  return (await getActiveGlossary(targetLang)).matcher
}

export interface ResolvedGlossaryTerms {
  terms: MatchedTerm[]
  /**
   * The glossary revision `terms` were read from, so a request can say WHICH
   * state of the glossary it is carrying. A batch can hold requests resolved
   * either side of an edit, and the background has no other way to tell which
   * wording is the newer one — see `mergeBatchGlossaryTerms`.
   *
   * 0 when there are no terms to carry, which loses every conflict.
   */
  revision: number
}

/** Terms present in `input`, or none when the feature is off or unavailable. */
export async function resolveGlossaryTerms(
  input: string,
  enabled: boolean,
  targetLang: LangCodeISO6393,
): Promise<ResolvedGlossaryTerms> {
  if (!enabled || input.trim() === "") return { terms: [], revision: 0 }
  const { matcher, revision } = await getActiveGlossary(targetLang)
  if (matcher.size === 0) return { terms: [], revision }
  return { terms: matcher.match(input), revision }
}

/** Drops the compiled matcher. Called after a write so the next match recompiles. */
export function invalidateActiveGlossaryMatcher(): void {
  cached = null
}

/**
 * Warm the matcher ahead of any user interaction. Fire-and-forget.
 *
 * Called once when a content script starts, so the interactive paths never have
 * to wait on a message round trip while a user watches.
 */
export function primeGlossaryMatcher(targetLang: LangCodeISO6393): void {
  // Explicitly swallowed: nothing awaits this, so an escaping rejection would
  // surface as an unhandled one on a page we do not own.
  void getActiveGlossaryMatcher(targetLang).catch(() => {})
}

/**
 * Terms for an INTERACTIVE path, without ever blocking on I/O.
 *
 * The selection toolbar runs while the user waits and races an abort, so this
 * must not add an await: an earlier version resolved the config and the snapshot
 * here, and the added latency was enough to let a popover close before the
 * request was issued. Uses the matcher only if it is already compiled for this
 * page, and otherwise starts warming it for next time — `primeGlossaryMatcher`
 * at content script start is what normally makes it ready long before a
 * selection.
 */
export function resolveGlossaryTermsFromCache(
  input: string,
  enabled: boolean,
  targetLang: LangCodeISO6393,
): MatchedTerm[] {
  if (!enabled || input.trim() === "") return []
  if (!cached || cached.url !== currentDocumentUrl() || cached.targetLang !== targetLang) {
    primeGlossaryMatcher(targetLang)
    return []
  }
  return cached.matcher.match(input)
}
