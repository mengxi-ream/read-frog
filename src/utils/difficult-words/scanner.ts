import type {
  VocabEvent,
  VocabJudgeBlock,
  VocabJudgedBlock,
  VocabLang,
  VocabMarkedWord,
  VocabSkippedBlock,
} from "@read-frog/api-contract"
import type { BlockText } from "./blocks"
import type { MarkKind, MarkTone } from "./highlights"
import type { SegmentedWords } from "./segment"
import type { DifficultWordsFailure, DifficultWordsJudgeResponse } from "./types"
import {
  VOCAB_JUDGE_MAX_BLOCKS,
  VOCAB_JUDGE_MAX_TEXT_LENGTH,
  VOCAB_JUDGE_MAX_WORDS,
} from "@read-frog/api-contract"
import { toneForColor } from "@/utils/annotate/layer"
import {
  BlockDiscovery,
  BlockResolver,
  findBlocksIn,
  getLanguageHint,
  isInScanSkippedSubtree,
  isScanSkipped,
  rangeForSpan,
  readBlockText,
} from "./blocks"
import { DifficultWordHighlights } from "./highlights"
import { isTextScript, segmentWords } from "./segment"
import { ensureDifficultWordsDocumentStyles, removeDifficultWordsDocumentStyles } from "./styles"
import { isVocabLang } from "./types"

// Marks the words a reader probably does not know, on the paragraphs near
// what they are reading.
//
// Paragraphs are found in slices of idle time and watched: those within a
// screen of the viewport are read, split into words and sent to be judged in
// batches as they come near, the ones on screen first. The page changing
// under a paragraph sends it again, but only if its words changed.
//
// Each answer says which version of the reader's threshold in its language
// it was judged with. A newer version (the reader just said they know a word,
// and the threshold moved) makes the paragraphs judged before it stale: they
// are judged again as they come near.

export interface DifficultWordMark {
  kind: MarkKind
  tone: MarkTone
  range: Range
  /** The word as on the page. */
  word: string
  lemma: string
  lang: VocabLang
  block: Element
}

export interface DifficultWordsScannerHost {
  judge: (blocks: VocabJudgeBlock[], events?: VocabEvent[]) => Promise<DifficultWordsJudgeResponse>
  /** Records with no paragraph to go with them. */
  record: (events: VocabEvent[]) => void
  /** Languages whose paragraphs wait for the reader's level. */
  onNeedsLevel: (langs: VocabLang[]) => void
  onFailure: (failure: DifficultWordsFailure) => void
  /** The server answered again after a failure. */
  onRecovered: () => void
  /** The marked words changed. */
  onMarksChange: () => void
  /** The whole page was read, and there is nothing on it to judge. */
  onEmpty: () => void
}

type BlockState = "new" | "sending" | "judged" | "skipped" | "empty"

interface ScanBlock {
  id: string
  element: Element
  state: BlockState
  /** Bumped on each send: the answer to an older one is dropped. */
  seq: number
  /** Changed while on its way to be judged. */
  dirty: boolean
  read: BlockText | null
  /** Word blocks: the words sent. */
  segmented: SegmentedWords | null
  wordIndex: Map<string, number> | null
  /** Text blocks: the text sent. */
  sentText: string | null
  payload: VocabJudgeBlock | null
  lang: VocabLang | null
  /** The threshold version it was judged with. */
  v: number
  result: Pick<VocabJudgedBlock, "hard" | "learning"> | null
  marks: DifficultWordMark[]
}

const MAX_IN_FLIGHT = 2
const FLUSH_DELAY_MS = 100
const DIRTY_DELAY_MS = 100
const SLICE_MS = 8
/** A paragraph shorter than this is detected with its neighbours. */
const SHORT_BLOCK_WORDS = 6
const SHORT_BLOCK_CHARS = 12
/** How long to wait before trying the server again, failure after failure. */
const OFFLINE_RETRY_MS = [2_000, 10_000, 60_000]
const RATE_LIMIT_FALLBACK_MS = 10_000
/** One screen above and below the viewport. */
const NEAR_MARGIN = "100% 0px 100% 0px"

function lemmaKey(lang: VocabLang, lemma: string) {
  return `${lang}\u0000${lemma}`
}

function isSkipped(result: VocabJudgedBlock | VocabSkippedBlock): result is VocabSkippedBlock {
  return "skip" in result
}

/** Ahead of the reader first: on screen, then below, then above. */
function viewportDistance(element: Element) {
  const rect = element.getBoundingClientRect()
  if (rect.bottom >= 0 && rect.top <= window.innerHeight) return 0
  return rect.top > window.innerHeight
    ? rect.top - window.innerHeight
    : window.innerHeight * 2 - rect.bottom
}

function isOnScreen(element: Element) {
  const rect = element.getBoundingClientRect()
  return rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0 && rect.height > 0
}

function scheduleIdle(callback: () => void): () => void {
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(callback, { timeout: 500 })
    return () => cancelIdleCallback(handle)
  }
  const handle = setTimeout(callback, 16)
  return () => clearTimeout(handle)
}

export class DifficultWordsScanner {
  private readonly resolver = new BlockResolver()
  private readonly highlights = new DifficultWordHighlights()
  private readonly blocks = new Map<Element, ScanBlock>()
  private readonly near = new Set<ScanBlock>()
  private readonly pending = new Set<ScanBlock>()
  private readonly awaitingLevel = new Map<VocabLang, Set<ScanBlock>>()
  private readonly byLemma = new Map<string, Set<DifficultWordMark>>()
  /** Words the reader said they know, unmarked here whatever an answer says. */
  private readonly hidden = new Set<string>()
  private readonly versions = new Map<VocabLang, number>()
  private readonly groups = new WeakMap<Element, string>()
  private readonly dirty = new Set<Element>()
  private readonly added: Node[] = []
  private sawRemovals = false
  private nextBlockId = 0
  private nextGroupId = 0
  private inFlight = 0
  private discovery: BlockDiscovery | null = null
  private cancelDiscovery: (() => void) | null = null
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private dirtyTimer: ReturnType<typeof setTimeout> | null = null
  /** No more requests until `resume()`: signed out, not in the beta, out of words for the day. */
  private halted: DifficultWordsFailure | null = null
  private pausedUntil = 0
  private offlineFailures = 0
  private failing = false
  private disposed = false
  private resumeTimer: ReturnType<typeof setTimeout> | null = null
  private readonly intersections = new IntersectionObserver(
    (entries) => this.onIntersect(entries),
    { rootMargin: NEAR_MARGIN },
  )

  private readonly mutations = new MutationObserver((records) => this.onMutations(records))
  private readonly onOnline = () => {
    this.pausedUntil = 0
    this.scheduleFlush(0)
  }

  constructor(private readonly host: DifficultWordsScannerHost) {}

  get available() {
    return this.highlights.available
  }

  /** How many different words are marked. */
  get count() {
    return this.byLemma.size
  }

  start() {
    ensureDifficultWordsDocumentStyles()
    const root = document.body
    if (!root) return
    this.mutations.observe(root, { childList: true, characterData: true, subtree: true })
    window.addEventListener("online", this.onOnline)
    this.discovery = new BlockDiscovery(root, this.resolver)
    this.scheduleDiscovery()
  }

  dispose() {
    this.disposed = true
    this.cancelDiscovery?.()
    if (this.flushTimer) clearTimeout(this.flushTimer)
    if (this.dirtyTimer) clearTimeout(this.dirtyTimer)
    if (this.resumeTimer) clearTimeout(this.resumeTimer)
    this.intersections.disconnect()
    this.mutations.disconnect()
    window.removeEventListener("online", this.onOnline)
    this.highlights.dispose()
    removeDifficultWordsDocumentStyles()
    this.blocks.clear()
    this.byLemma.clear()
  }

  /** The marked word at a viewport point, if any. */
  markAt(x: number, y: number): DifficultWordMark | null {
    const element = document.elementFromPoint(x, y)
    const blockElement = element && this.resolver.blockOf(element)
    const block = blockElement ? this.blocks.get(blockElement) : undefined
    if (!block) return null
    for (const mark of block.marks) {
      for (const rect of mark.range.getClientRects()) {
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return mark
      }
    }
    return null
  }

  /** Deepens a mark under the pointer; `null` for none. */
  setHover(mark: DifficultWordMark | null) {
    this.highlights.setHover(mark)
  }

  /** The language of the judged paragraph `node` is in, if it was judged. */
  languageAt(node: Node): VocabLang | null {
    const element = node instanceof Element ? node : node.parentElement
    const blockElement = element && this.resolver.blockOf(element)
    const block = blockElement ? this.blocks.get(blockElement) : undefined
    return block?.state === "judged" ? block.lang : null
  }

  /** The paragraph a mark is in, as the card's context. */
  paragraphOf(mark: DifficultWordMark): string {
    const block = this.blocks.get(mark.block)
    return (block?.read?.text ?? mark.word).replace(/\s+/g, " ").trim()
  }

  /** Whether `mark` is still painted: the reader may have unmarked its word since. */
  isMarked(mark: DifficultWordMark) {
    return this.byLemma.get(lemmaKey(mark.lang, mark.lemma))?.has(mark) ?? false
  }

  /** Unmarks a word in every paragraph, and keeps it unmarked. */
  hideLemma(lang: VocabLang, lemma: string) {
    const key = lemmaKey(lang, lemma)
    this.hidden.add(key)
    const marks = this.byLemma.get(key)
    if (!marks) return
    this.byLemma.delete(key)
    for (const mark of marks) {
      this.highlights.remove(mark.kind, mark.tone, mark.range)
      const block = this.blocks.get(mark.block)
      if (block) block.marks = block.marks.filter((other) => other !== mark)
    }
    this.host.onMarksChange()
  }

  /** Marks a word again where the answers had it: an undone "I know it". */
  showLemma(lang: VocabLang, lemma: string) {
    const key = lemmaKey(lang, lemma)
    if (!this.hidden.delete(key)) return
    for (const block of this.blocks.values()) {
      if (block.state !== "judged" || block.lang !== lang || !block.result) continue
      const words = [...block.result.hard, ...block.result.learning]
      if (words.some((word) => word.lemma === lemma)) this.paint(block)
    }
    this.host.onMarksChange()
  }

  /**
   * Sends `events` with the judged paragraphs on screen, so they come back
   * judged with the records counted.
   */
  refreshVisible(events: VocabEvent[]) {
    const visible = [...this.near].filter(
      (block) => block.state === "judged" && block.payload && isOnScreen(block.element),
    )
    if (this.halted || visible.length === 0) {
      this.host.record(events)
      return
    }
    const batch: ScanBlock[] = []
    let words = 0
    let chars = 0
    for (const block of visible) {
      const payload = block.payload!
      const blockWords = payload.words?.length ?? 0
      const blockChars = payload.text?.length ?? 0
      if (
        batch.length >= VOCAB_JUDGE_MAX_BLOCKS ||
        words + blockWords > VOCAB_JUDGE_MAX_WORDS ||
        chars + blockChars > VOCAB_JUDGE_MAX_TEXT_LENGTH
      ) {
        break
      }
      this.pending.delete(block)
      batch.push(block)
      words += blockWords
      chars += blockChars
    }
    void this.send(batch, events)
  }

  /** The reader gave a level in `lang`: its paragraphs waiting for it are judged. */
  retryLevel(lang: VocabLang) {
    const waiting = this.awaitingLevel.get(lang)
    this.awaitingLevel.delete(lang)
    for (const block of waiting ?? []) {
      if (block.state !== "skipped") continue
      block.state = "new"
      if (this.near.has(block)) this.pending.add(block)
    }
    this.scheduleFlush(0)
  }

  /** Requests may go out again: the reader signed in, or a new day began. */
  resume() {
    if (this.disposed) return
    if (this.resumeTimer) clearTimeout(this.resumeTimer)
    this.resumeTimer = null
    this.halted = null
    this.pausedUntil = 0
    for (const block of this.near) {
      if (block.state === "new" || this.isStale(block)) this.pending.add(block)
    }
    this.scheduleFlush(0)
  }

  private scheduleDiscovery() {
    this.cancelDiscovery = scheduleIdle(() => {
      this.cancelDiscovery = null
      const discovery = this.discovery
      if (this.disposed || !discovery) return
      const sliceEnd = performance.now() + SLICE_MS
      discovery.run(
        () => performance.now() >= sliceEnd,
        (element) => this.addBlock(element),
      )
      if (!discovery.finished) {
        this.scheduleDiscovery()
        return
      }
      this.discovery = null
      if (this.blocks.size === 0) this.host.onEmpty()
    })
  }

  private addBlock(element: Element) {
    if (this.blocks.has(element)) return
    this.nextBlockId += 1
    this.blocks.set(element, {
      id: `b${this.nextBlockId}`,
      element,
      state: "new",
      seq: 0,
      dirty: false,
      read: null,
      segmented: null,
      wordIndex: null,
      sentText: null,
      payload: null,
      lang: null,
      v: 0,
      result: null,
      marks: [],
    })
    this.intersections.observe(element)
  }

  private drop(block: ScanBlock) {
    this.intersections.unobserve(block.element)
    this.clearMarks(block)
    this.blocks.delete(block.element)
    this.near.delete(block)
    this.pending.delete(block)
    if (block.lang) this.awaitingLevel.get(block.lang)?.delete(block)
  }

  private isStale(block: ScanBlock) {
    return (
      block.state === "judged" &&
      block.lang !== null &&
      block.v < (this.versions.get(block.lang) ?? 0)
    )
  }

  private onIntersect(entries: IntersectionObserverEntry[]) {
    for (const entry of entries) {
      const block = this.blocks.get(entry.target)
      if (!block) continue
      if (!entry.isIntersecting) {
        this.near.delete(block)
        continue
      }
      this.near.add(block)
      if (block.state === "new" || this.isStale(block)) {
        this.pending.add(block)
        this.scheduleFlush(FLUSH_DELAY_MS)
      }
    }
  }

  private scheduleFlush(delay: number) {
    if (this.disposed || this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      this.flush()
    }, delay)
  }

  private flush() {
    if (this.disposed || this.halted) return
    const wait = this.pausedUntil - Date.now()
    if (wait > 0) {
      this.scheduleFlush(wait)
      return
    }
    while (this.inFlight < MAX_IN_FLIGHT && this.pending.size > 0) {
      const batch = this.takeBatch()
      if (batch.length === 0) break
      void this.send(batch)
    }
  }

  private takeBatch(): ScanBlock[] {
    const candidates: ScanBlock[] = []
    for (const block of this.pending) {
      if (block.element.isConnected) candidates.push(block)
      else this.drop(block)
    }
    const distances = new Map(candidates.map((block) => [block, viewportDistance(block.element)]))
    candidates.sort((a, b) => distances.get(a)! - distances.get(b)!)

    const batch: ScanBlock[] = []
    let words = 0
    let chars = 0
    for (const block of candidates) {
      if (batch.length >= VOCAB_JUDGE_MAX_BLOCKS) break
      const payload = this.prepare(block)
      if (!payload) {
        this.pending.delete(block)
        continue
      }
      const blockWords = payload.words?.length ?? 0
      const blockChars = payload.text?.length ?? 0
      if (words + blockWords > VOCAB_JUDGE_MAX_WORDS) continue
      if (chars + blockChars > VOCAB_JUDGE_MAX_TEXT_LENGTH) continue
      this.pending.delete(block)
      batch.push(block)
      words += blockWords
      chars += blockChars
    }
    return batch
  }

  /** Reads a paragraph into what is sent for it; `null` when it has no words. */
  private prepare(block: ScanBlock): VocabJudgeBlock | null {
    const read = readBlockText(block.element, this.resolver)
    if (block.payload && block.read?.text === read.text) {
      block.read = read
      return block.payload
    }
    block.read = read
    block.segmented = null
    block.wordIndex = null
    block.sentText = null
    block.payload = null

    const text = read.text
    const hint = getLanguageHint(block.element)
    let payload: VocabJudgeBlock
    let short: boolean
    if (isTextScript(text)) {
      const sent = text.slice(0, VOCAB_JUDGE_MAX_TEXT_LENGTH)
      if (!/\p{L}/u.test(sent)) return this.markEmpty(block)
      block.sentText = sent
      payload = { id: block.id, text: sent }
      short = sent.trim().length < SHORT_BLOCK_CHARS
    } else {
      const segmented = segmentWords(text)
      if (segmented.words.length === 0) return this.markEmpty(block)
      block.segmented = segmented
      block.wordIndex = new Map(segmented.words.map((word, index) => [word, index]))
      payload = {
        id: block.id,
        words: segmented.words,
        ...(segmented.starts.length > 0 ? { starts: segmented.starts } : {}),
      }
      short = segmented.words.length < SHORT_BLOCK_WORDS
    }
    if (hint) payload.hint = hint
    const parent = block.element.parentElement
    if (short && parent) payload.group = this.groupOf(parent)
    block.payload = payload
    return payload
  }

  private markEmpty(block: ScanBlock): null {
    block.state = "empty"
    this.clearMarks(block)
    return null
  }

  /** Neighbouring short paragraphs, the items of one list, say, are detected together. */
  private groupOf(parent: Element) {
    let group = this.groups.get(parent)
    if (!group) {
      this.nextGroupId += 1
      group = `g${this.nextGroupId}`
      this.groups.set(parent, group)
    }
    return group
  }

  private async send(batch: ScanBlock[], events?: VocabEvent[]) {
    const sent = batch.map((block) => {
      block.seq += 1
      block.state = "sending"
      block.dirty = false
      return { block, seq: block.seq, payload: block.payload! }
    })
    this.inFlight += 1
    let response: DifficultWordsJudgeResponse
    try {
      response = await this.host.judge(
        sent.map((entry) => entry.payload),
        events,
      )
    } catch {
      response = { ok: false, failure: { kind: "offline" } }
    }
    this.inFlight -= 1
    if (this.disposed) return

    if (!response.ok) {
      this.onSendFailed(sent, response.failure)
      return
    }
    this.offlineFailures = 0
    if (this.failing) {
      this.failing = false
      this.host.onRecovered()
    }
    response.output.blocks.forEach((result, index) => {
      const entry = sent[index]
      if (!entry || entry.block.seq !== entry.seq || result.id !== entry.payload.id) return
      this.apply(entry.block, result)
    })
    if (response.output.needsLevel.length > 0) this.host.onNeedsLevel(response.output.needsLevel)
    this.host.onMarksChange()
    this.scheduleFlush(0)
  }

  private onSendFailed(
    sent: Array<{ block: ScanBlock; seq: number }>,
    failure: DifficultWordsFailure,
  ) {
    for (const { block, seq } of sent) {
      if (block.seq !== seq) continue
      if (failure.kind === "error") {
        // Refused as sent: not sent again until it changes.
        block.state = block.result ? "judged" : "skipped"
        continue
      }
      // Marks already painted stay: they are still the best answer there is.
      block.state = block.result ? "judged" : "new"
      if (block.state === "new" && this.near.has(block)) this.pending.add(block)
    }
    this.failing = true
    this.host.onFailure(failure)

    const now = Date.now()
    switch (failure.kind) {
      case "signedOut":
      case "restricted":
        this.halted = failure
        break
      case "dailyLimit": {
        this.halted = failure
        const resetAt = failure.resetAt ? Date.parse(failure.resetAt) : Number.NaN
        if (Number.isFinite(resetAt) && resetAt - now < 24 * 60 * 60_000) {
          if (this.resumeTimer) clearTimeout(this.resumeTimer)
          this.resumeTimer = setTimeout(() => this.resume(), Math.max(0, resetAt - now))
        }
        break
      }
      case "rateLimited": {
        const resetAt = failure.resetAt ? Date.parse(failure.resetAt) : Number.NaN
        this.pausedUntil = Number.isFinite(resetAt) ? resetAt : now + RATE_LIMIT_FALLBACK_MS
        this.scheduleFlush(Math.max(0, this.pausedUntil - now))
        break
      }
      case "offline": {
        const delay = OFFLINE_RETRY_MS[Math.min(this.offlineFailures, OFFLINE_RETRY_MS.length - 1)]!
        this.offlineFailures += 1
        this.pausedUntil = now + delay
        this.scheduleFlush(delay)
        break
      }
      case "error":
      default:
        this.scheduleFlush(FLUSH_DELAY_MS)
        break
    }
  }

  private apply(block: ScanBlock, result: VocabJudgedBlock | VocabSkippedBlock) {
    if (isSkipped(result)) {
      block.state = "skipped"
      block.result = null
      block.lang = isVocabLang(result.lang) ? result.lang : null
      this.clearMarks(block)
      if (result.skip === "level" && block.lang) {
        let waiting = this.awaitingLevel.get(block.lang)
        if (!waiting) {
          waiting = new Set()
          this.awaitingLevel.set(block.lang, waiting)
        }
        waiting.add(block)
      }
    } else {
      block.state = "judged"
      block.lang = result.lang
      block.v = result.v
      block.result = { hard: result.hard, learning: result.learning }
      this.paint(block)
      this.noteVersion(result.lang, result.v)
      if (this.isStale(block) && this.near.has(block)) this.pending.add(block)
    }
    if (block.dirty) {
      block.dirty = false
      this.markDirty(block.element)
    }
  }

  private noteVersion(lang: VocabLang, v: number) {
    if (v <= (this.versions.get(lang) ?? 0)) return
    this.versions.set(lang, v)
    for (const block of this.near) {
      if (this.isStale(block)) this.pending.add(block)
    }
  }

  private paint(block: ScanBlock) {
    this.clearMarks(block)
    const { result, read, lang } = block
    if (!result || !read || !lang) return
    const tone = toneForColor(getComputedStyle(block.element).color)
    for (const kind of ["hard", "learning"] as const) {
      for (const word of result[kind]) {
        const key = lemmaKey(lang, word.lemma)
        if (this.hidden.has(key)) continue
        for (const range of this.rangesFor(block, read, word)) {
          const mark: DifficultWordMark = {
            kind,
            tone,
            range,
            word: word.w,
            lemma: word.lemma,
            lang,
            block: block.element,
          }
          block.marks.push(mark)
          this.highlights.add(kind, tone, range)
          let marks = this.byLemma.get(key)
          if (!marks) {
            marks = new Set()
            this.byLemma.set(key, marks)
          }
          marks.add(mark)
        }
      }
    }
  }

  private rangesFor(block: ScanBlock, read: BlockText, word: VocabMarkedWord): Range[] {
    const ranges: Range[] = []
    if (block.segmented && block.wordIndex) {
      const index = block.wordIndex.get(word.w)
      for (const span of index === undefined ? [] : block.segmented.spans[index]!) {
        const range = rangeForSpan(read, span.start, span.end)
        if (range) ranges.push(range)
      }
    } else if (block.sentText !== null) {
      for (const at of word.at ?? []) {
        if (!block.sentText.startsWith(word.w, at)) continue
        const range = rangeForSpan(read, at, at + word.w.length)
        if (range) ranges.push(range)
      }
    }
    return ranges
  }

  private clearMarks(block: ScanBlock) {
    if (block.marks.length === 0) return
    for (const mark of block.marks) {
      this.highlights.remove(mark.kind, mark.tone, mark.range)
      const key = lemmaKey(mark.lang, mark.lemma)
      const marks = this.byLemma.get(key)
      marks?.delete(mark)
      if (marks?.size === 0) this.byLemma.delete(key)
    }
    block.marks = []
  }

  private onMutations(records: MutationRecord[]) {
    for (const record of records) {
      const target = record.target
      if (record.type === "characterData") {
        const parent = target.parentElement
        if (parent && !isInScanSkippedSubtree(target)) this.markDirty(parent)
        continue
      }
      if (!(target instanceof Element) || isScanSkipped(target) || isInScanSkippedSubtree(target)) {
        continue
      }
      this.markDirty(target)
      for (const node of record.addedNodes) {
        if (node instanceof Element) this.resolver.forget(node)
        this.added.push(node)
      }
      if (record.removedNodes.length > 0) this.sawRemovals = true
    }
  }

  /** The paragraph `element`'s own text is in changed: read it again soon. */
  private markDirty(element: Element) {
    const block = this.resolver.blockOf(element)
    if (!block) return
    this.dirty.add(block)
    if (this.disposed || this.dirtyTimer) return
    this.dirtyTimer = setTimeout(() => {
      this.dirtyTimer = null
      this.processDirty()
    }, DIRTY_DELAY_MS)
  }

  private processDirty() {
    if (this.disposed) return
    for (const node of this.added.splice(0)) {
      if (!node.isConnected) continue
      for (const element of findBlocksIn(node, this.resolver)) {
        if (this.blocks.has(element)) this.dirty.add(element)
        else this.addBlock(element)
      }
    }
    if (this.sawRemovals) {
      this.sawRemovals = false
      for (const block of [...this.blocks.values()]) {
        if (!block.element.isConnected) this.drop(block)
      }
    }
    let changed = false
    for (const element of [...this.dirty]) {
      this.dirty.delete(element)
      const block = this.blocks.get(element)
      if (!block) {
        if (element.isConnected) this.addBlock(element)
        continue
      }
      changed = this.refresh(block) || changed
    }
    if (changed) this.host.onMarksChange()
  }

  /** Reads a changed paragraph again; whether its marks changed. */
  private refresh(block: ScanBlock): boolean {
    if (block.state === "sending") {
      block.dirty = true
      return false
    }
    if (block.state === "new") return false
    const previous = block.read
    const read = readBlockText(block.element, this.resolver)
    if (previous && read.text === previous.text) {
      // The same words, maybe in new text nodes: paint them there.
      const sameNodes =
        read.nodes.length === previous.nodes.length &&
        read.nodes.every((node, index) => node === previous.nodes[index])
      block.read = read
      if (sameNodes || block.state !== "judged") return false
      this.paint(block)
      return true
    }
    const hadMarks = block.marks.length > 0
    this.clearMarks(block)
    block.state = "new"
    block.payload = null
    if (this.near.has(block)) {
      this.pending.add(block)
      this.scheduleFlush(FLUSH_DELAY_MS)
    }
    return hadMarks
  }
}
