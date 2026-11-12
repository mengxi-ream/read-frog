import type { LogFields } from "@/utils/logging/logger"
import { createLogger } from "@/utils/logging/logger"
import { getPageTranslationSessionId } from "./translation-session"

/**
 * Why page translation left a paragraph as it was. Every paragraph the page
 * modes consider ends with a verdict: translated, or one of these reasons,
 * named by the step that decided it. The "Diagnose this page" overlay shows
 * them on the page, and a summary per session goes to the local log, so "some
 * paragraphs are not translated" turns into which ones, and why.
 */
export const UNTRANSLATED_REASONS = [
  // Nothing to translate: empty, numbers only, or formulas only.
  "noProse",
  // Shorter than the user's minimum paragraph length.
  "tooShort",
  // Already in the target language.
  "targetLanguage",
  // In a language the user set page translation to skip.
  "skipLanguage",
  // The model answered that the paragraph needs no translation.
  "noTranslationNeeded",
  // The translation came back identical to the original.
  "sameAsSource",
  // The service answered with nothing.
  "emptyResult",
  // The request failed; the error shows on the page.
  "error",
] as const
export type UntranslatedReason = (typeof UNTRANSLATED_REASONS)[number]
export type ParagraphVerdict = "translated" | UntranslatedReason

/** Reports how one paragraph ended. The first call wins: the step that decided names the reason. */
export interface ParagraphDiagnosis {
  translated: () => void
  untranslated: (reason: UntranslatedReason, fields?: LogFields) => void
}

const log = createLogger("host/translate/paragraph-diagnosis")

/** Reasons that suggest something went wrong rather than a filter doing its job: logged one by one. */
const NOTABLE_REASONS: ReadonlySet<UntranslatedReason> = new Set(["emptyResult", "error"])
/** A failing page fails every paragraph; the first few say why, the summary says how many. */
const MAX_NOTABLE_LOGS_PER_REASON = 10
const MAX_TRACKED_PARAGRAPHS = 2000
const SAMPLES_PER_REASON = 3
const SUMMARY_DELAY_MS = 10_000

interface TrackedParagraph {
  // Weak: on an endless feed, the paragraphs the site throws away must not stay alive here.
  first: WeakRef<Node>
  last: WeakRef<Node>
  verdict: ParagraphVerdict
}

interface SessionDiagnosis {
  sessionId: string | null
  /** Latest verdict per paragraph, oldest first. */
  paragraphs: Map<string, TrackedParagraph>
  /** Paragraphs per verdict, each counted once, under its latest verdict. */
  totals: Map<ParagraphVerdict, number>
  samples: Map<UntranslatedReason, string[]>
  notableLogs: Map<UntranslatedReason, number>
  lastSummary: string | null
}

function createSessionDiagnosis(sessionId: string | null): SessionDiagnosis {
  return {
    sessionId,
    paragraphs: new Map(),
    totals: new Map(),
    samples: new Map(),
    notableLogs: new Map(),
    lastSummary: null,
  }
}

let session = createSessionDiagnosis(null)
let summaryTimer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

const anchorIds = new WeakMap<Node, number>()
let nextAnchorId = 0

function getParagraphKey(anchor: Node, part: string | undefined): string {
  let id = anchorIds.get(anchor)
  if (id === undefined) {
    id = nextAnchorId++
    anchorIds.set(anchor, id)
  }
  return part === undefined ? `${id}` : `${id}:${part}`
}

/** Paragraphs translated without a session (hover, shortcut) join the current one. */
function getCurrentSession(): SessionDiagnosis {
  const sessionId = getPageTranslationSessionId()
  if (sessionId !== null && sessionId !== session.sessionId) {
    logSessionSummary()
    session = createSessionDiagnosis(sessionId)
  }
  return session
}

function addToTotal(verdict: ParagraphVerdict, delta: number): void {
  session.totals.set(verdict, (session.totals.get(verdict) ?? 0) + delta)
}

function record(
  first: Node,
  last: Node,
  part: string | undefined,
  text: string,
  verdict: ParagraphVerdict,
  fields: LogFields,
): void {
  const current = getCurrentSession()
  const key = getParagraphKey(first, part)

  const previous = current.paragraphs.get(key)
  if (previous) {
    addToTotal(previous.verdict, -1)
    current.paragraphs.delete(key)
  }
  current.paragraphs.set(key, { first: new WeakRef(first), last: new WeakRef(last), verdict })
  addToTotal(verdict, 1)
  if (current.paragraphs.size > MAX_TRACKED_PARAGRAPHS) {
    current.paragraphs.delete(current.paragraphs.keys().next().value!)
  }

  if (verdict !== "translated") {
    const samples = current.samples.get(verdict) ?? []
    current.samples.set(verdict, [...samples, text].slice(-SAMPLES_PER_REASON))

    const logged = current.notableLogs.get(verdict) ?? 0
    if (NOTABLE_REASONS.has(verdict) && logged < MAX_NOTABLE_LOGS_PER_REASON) {
      current.notableLogs.set(verdict, logged + 1)
      log.warn("Paragraph not translated", { reason: verdict, text, ...fields })
    }
  }

  clearTimeout(summaryTimer)
  summaryTimer = setTimeout(logSessionSummary, SUMMARY_DELAY_MS)
  listeners.forEach((listener) => listener())
}

const IGNORED_DIAGNOSIS: ParagraphDiagnosis = { translated: () => {}, untranslated: () => {} }

/**
 * Starts the record of one paragraph: `nodes` is the run it is made of, which
 * the overlay outlines, and `text` what a summary may quote of it. `part` tells
 * apart paragraphs of one run, such as the blank-line paragraphs of one
 * pre-wrapped container. A later verdict for the same paragraph replaces the
 * earlier one. A run with no visible text, such as the whitespace between two
 * blocks, is no paragraph to anyone reading the page and gets no verdict.
 */
export function diagnoseParagraph(
  nodes: readonly Node[],
  text: string,
  part?: string,
): ParagraphDiagnosis {
  const first = nodes[0]
  const last = nodes.at(-1)
  if (!first || !last || !nodes.some((node) => node.textContent?.trim())) return IGNORED_DIAGNOSIS

  let settled = false
  const settle = (verdict: ParagraphVerdict, fields: LogFields = {}) => {
    if (settled) return
    settled = true
    record(first, last, part, text, verdict, fields)
  }
  return {
    translated: () => settle("translated"),
    untranslated: (reason, fields) => settle(reason, fields),
  }
}

/**
 * Settles a paragraph from what the service returned and what is shown. An
 * empty answer was already explained by the step that produced it, which
 * reported first; an identical one only shows up here. Nothing to show and no
 * empty string means the request failed (reported where the error is shown)
 * or the paragraph changed while it was out: no verdict.
 */
export function settleDisplayedTranslation(
  diagnosis: ParagraphDiagnosis,
  returnedText: string | undefined,
  displayedText: string | undefined,
): void {
  if (displayedText) diagnosis.translated()
  else if (displayedText === "")
    diagnosis.untranslated(returnedText ? "sameAsSource" : "emptyResult")
}

/** Puts the session's outcome in the local log, unless it is unchanged since the last time. */
export function logSessionSummary(): void {
  clearTimeout(summaryTimer)
  summaryTimer = undefined
  if (session.totals.size === 0) return

  const counts = Object.fromEntries(
    [...session.totals].filter(([, count]) => count > 0).sort(([a], [b]) => a.localeCompare(b)),
  )
  const summary = JSON.stringify(counts)
  if (summary === session.lastSummary) return
  session.lastSummary = summary

  log.info("Page translation outcome", {
    sessionId: session.sessionId,
    counts,
    samples: Object.fromEntries(
      [...session.samples].map(([reason, texts]) => [reason, texts.map((text) => ({ text }))]),
    ),
  })
}

export interface DiagnosedParagraph {
  key: string
  verdict: ParagraphVerdict
  /** The first and last node of its run; the same element for a paragraph that is one. */
  first: Node
  last: Node
}

/** The paragraphs of the current session that are still on the page, with their latest verdict. */
export function getDiagnosedParagraphs(): DiagnosedParagraph[] {
  const paragraphs: DiagnosedParagraph[] = []
  for (const [key, tracked] of session.paragraphs) {
    const first = tracked.first.deref()
    const last = tracked.last.deref()
    if (!first || !last) {
      session.paragraphs.delete(key)
    } else if (first.isConnected && last.isConnected) {
      paragraphs.push({ key, verdict: tracked.verdict, first, last })
    }
  }
  return paragraphs
}

/**
 * Page translation was turned off. Its translations are gone from the page, so
 * its paragraphs leave the record, and an open overlay shows the page as it is.
 * Paragraphs translated later without a session (hover, shortcut) start a new one.
 */
export function endParagraphDiagnosisSession(): void {
  logSessionSummary()
  session = createSessionDiagnosis(null)
  listeners.forEach((listener) => listener())
}

/** Called after every new verdict, and when the session ends; returns the unsubscribe. */
export function subscribeParagraphDiagnosis(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Hidden comes before the page is unloaded, while there is still time to send the log.
globalThis.document?.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") logSessionSummary()
})

/** Tests only. */
export function resetParagraphDiagnosis(): void {
  clearTimeout(summaryTimer)
  summaryTimer = undefined
  session = createSessionDiagnosis(null)
  listeners.clear()
}
