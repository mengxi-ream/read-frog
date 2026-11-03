import type { VocabEvent, VocabLang, VocabLevel, VocabWordEventKind } from "@read-frog/api-contract"
import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { SelectionSession } from "../selection-toolbar/atoms"
import type { CustomActionRequest } from "@/components/custom-action/atoms"
import type { SaveToNotebaseOutcome } from "@/components/custom-action/use-save-to-notebase"
import type { SelectionPopoverPosition } from "@/components/ui/selection-popover"
import type { Config } from "@/types/config/config"
import type { DifficultWordMark } from "@/utils/difficult-words/scanner"
import type { DifficultWordLemmaChange, DifficultWordsFailure } from "@/utils/difficult-words/types"
import { VOCAB_WORD_MAX_LENGTH } from "@read-frog/api-contract"
import { toastManager } from "@/components/ui/base-ui/toast"
import { createSelectionToolbarPrecheckError } from "@/components/ui/selection-popover/inline-error"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { resolveDifficultWordLookupAction } from "@/utils/custom-actions"
import { DifficultWordsScanner } from "@/utils/difficult-words/scanner"
import { segmentWords } from "@/utils/difficult-words/segment"
import { DIFFICULT_WORD_HOVER_ATTRIBUTE } from "@/utils/difficult-words/styles"
import { uuidv7 } from "@/utils/difficult-words/uuid"
import { logInUrl } from "@/utils/error-action"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { orpcClient } from "@/utils/orpc/client"
import { toLiveRange } from "../utils"

/** How long the pointer rests on a word before its ✓ shows, and stays after leaving. */
const CHECK_DELAY_MS = 300
/** How long a click waits for a second one, which selects the word instead. */
const OPEN_DELAY_MS = 300
/** Further than this between press and release, the click was a drag. */
const CLICK_SLOP_PX = 4
const UNDO_MS = 5_000
/** Where a click goes to the page as it would without the marks. */
const PASS_THROUGH_SELECTOR = "a, button, input, label, summary, [role=button], [contenteditable]"

const SIGNED_OUT_TOAST_ID = "difficult-words-signed-out"
const RESTRICTED_TOAST_ID = "difficult-words-restricted"
const LIMIT_TOAST_ID = "difficult-words-limit"
const OFFLINE_TOAST_ID = "difficult-words-offline"
const EMPTY_TOAST_ID = "difficult-words-empty"

export interface DifficultWordCardView {
  mark: DifficultWordMark
  anchor: SelectionPopoverPosition
  /** Remounts the card for each word. */
  key: number
}

export interface DifficultWordsView {
  card: DifficultWordCardView | null
  /** The ✓ over the word the pointer rests on, at its last line. */
  check: { mark: DifficultWordMark; rect: { right: number; top: number } } | null
  /** The language whose level is being asked. */
  levelLang: VocabLang | null
}

export interface DifficultWordsSessionOptions {
  getConfig: () => Config
  setRequest: (request: CustomActionRequest | null) => void
  /** Annotation mode is on: a click annotates the word instead of opening its card. */
  isAnnotationMode: () => boolean
  annotate: (session: SelectionSession) => boolean
  /** The server will not take this account: marking is switched off. */
  onRestricted: () => void
  /** How many different words are marked changed. */
  onCountChange: (count: number) => void
}

function formatResetTime(resetAt: string | null) {
  const date = resetAt ? new Date(resetAt) : null
  if (!date || Number.isNaN(date.getTime())) return ""
  const sameDay = date.toDateString() === new Date().toDateString()
  return date.toLocaleString(undefined, {
    ...(sameDay ? {} : { month: "numeric", day: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Marking needs an account: the notice offers to sign in. */
export function showSignInRequiredNotice() {
  const toastId = toastManager.add({
    id: SIGNED_OUT_TOAST_ID,
    type: "error",
    title: i18n.t("difficultWords.signInRequired"),
    actionProps: {
      children: i18n.t("account.login"),
      onClick: () => {
        toastManager.close(toastId)
        void sendMessage("openPage", { url: logInUrl(), active: true })
      },
    },
  })
}

/** The account is not in the test the feature is open to. */
export function showRestrictedNotice() {
  toastManager.add({
    id: RESTRICTED_TOAST_ID,
    type: "error",
    title: i18n.t("difficultWords.restricted"),
  })
}

/** The last line a range is on, in viewport px. */
function lastLineRect(range: Range): DOMRect {
  const rects = range.getClientRects()
  return rects[rects.length - 1] ?? range.getBoundingClientRect()
}

/**
 * One page's marking while it is on: the scanner, the pointer over the marks,
 * a marked word's card and ✓, the level asked for a new language, and what
 * the reader does with the words, recorded for the server.
 */
export class DifficultWordsSession {
  private view: DifficultWordsView = { card: null, check: null, levelLang: null }
  private readonly listeners = new Set<() => void>()
  private readonly scanner: DifficultWordsScanner
  private readonly dismissedLevels = new Set<VocabLang>()
  private pointer: { x: number; y: number } | null = null
  private frame = 0
  private hovered: DifficultWordMark | null = null
  private overCheck = false
  private showCheckTimer: ReturnType<typeof setTimeout> | null = null
  private hideCheckTimer: ReturnType<typeof setTimeout> | null = null
  private openTimer: ReturnType<typeof setTimeout> | null = null
  private down: { x: number; y: number } | null = null
  private nextCardKey = 0
  /** Halted for want of an account: looked at again when the reader is back. */
  private signedOut = false
  private disposed = false

  constructor(
    private readonly own: LangCodeISO6393,
    private readonly options: DifficultWordsSessionOptions,
  ) {
    this.scanner = new DifficultWordsScanner({
      judge: (blocks, events) =>
        sendMessage("judgeDifficultWords", { own: this.own, blocks, events }),
      record: (events) => {
        void sendMessage("recordDifficultWordEvents", { events })
      },
      onNeedsLevel: (langs) => this.askLevel(langs),
      onFailure: (failure) => this.showFailure(failure),
      onRecovered: () => toastManager.close(OFFLINE_TOAST_ID),
      onMarksChange: () => this.options.onCountChange(this.scanner.count),
      onEmpty: () => {
        toastManager.add({
          id: EMPTY_TOAST_ID,
          type: "info",
          title: i18n.t("difficultWords.empty"),
        })
      },
    })
  }

  get count() {
    return this.scanner.count
  }

  getView = () => this.view

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  start() {
    this.scanner.start()
    window.addEventListener("pointermove", this.onPointerMove, { capture: true, passive: true })
    window.addEventListener("pointerdown", this.onPointerDown, { capture: true, passive: true })
    window.addEventListener("click", this.onClick, true)
    window.addEventListener("scroll", this.onScroll, { capture: true, passive: true })
    document.addEventListener("visibilitychange", this.onVisibilityChange)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    window.removeEventListener("pointermove", this.onPointerMove, true)
    window.removeEventListener("pointerdown", this.onPointerDown, true)
    window.removeEventListener("click", this.onClick, true)
    window.removeEventListener("scroll", this.onScroll, true)
    document.removeEventListener("visibilitychange", this.onVisibilityChange)
    if (this.frame) cancelAnimationFrame(this.frame)
    for (const timer of [this.showCheckTimer, this.hideCheckTimer, this.openTimer]) {
      if (timer) clearTimeout(timer)
    }
    document.documentElement.removeAttribute(DIFFICULT_WORD_HOVER_ATTRIBUTE)
    const card = this.view.card
    if (card) {
      this.options.setRequest(null)
      this.record(card.mark, "open")
    }
    this.scanner.dispose()
    toastManager.close(OFFLINE_TOAST_ID)
    this.listeners.clear()
  }

  // ---- what the UI calls

  /** Whether a press landed on a marked word. */
  isOverMark = (event: Event) =>
    event instanceof MouseEvent && this.scanner.markAt(event.clientX, event.clientY) !== null

  closeCard = () => {
    const card = this.view.card
    if (!card) return
    this.options.setRequest(null)
    this.setView({ card: null })
    // Opened and closed without "I know it": counts against knowing it,
    // and the paragraphs on screen are judged again with it counted.
    const event = this.event(card.mark, "open")
    if (event) this.scanner.refreshVisible([event])
  }

  markCardKnown = () => {
    const card = this.view.card
    if (!card) return
    this.options.setRequest(null)
    this.setView({ card: null })
    this.markKnown(card.mark, true)
  }

  onCardSave = (outcome: SaveToNotebaseOutcome) => {
    const card = this.view.card
    if (!card || outcome === "failed") return
    this.record(card.mark, "save")
  }

  markCheckKnown = () => {
    const check = this.view.check
    if (!check) return
    this.setView({ check: null })
    this.markKnown(check.mark, false)
  }

  checkPointerEnter = () => {
    this.overCheck = true
    this.clearTimer("hideCheckTimer")
  }

  checkPointerLeave = () => {
    this.overCheck = false
    if (!this.hovered) this.hideCheckSoon()
  }

  pickLevel = async (level: VocabLevel) => {
    const lang = this.view.levelLang
    if (!lang) return
    try {
      await orpcClient.vocab.setLevel({ lang, level })
    } catch (error) {
      toastManager.add({ type: "error", title: i18n.t("difficultWords.level.saveFailed") })
      throw error
    }
    if (this.disposed) return
    this.setView({ levelLang: null })
    this.scanner.retryLevel(lang)
  }

  dismissLevel = () => {
    const lang = this.view.levelLang
    if (lang) this.dismissedLevels.add(lang)
    this.setView({ levelLang: null })
  }

  /** Another tab unmarked a word, or brought it back. */
  applyLemmaChange(change: DifficultWordLemmaChange) {
    if (change.known) this.scanner.hideLemma(change.lang, change.lemma)
    else this.scanner.showLemma(change.lang, change.lemma)
  }

  /** A selection was looked up: a word in a judged paragraph counts against knowing it. */
  onSelectionLookup(session: SelectionSession) {
    const snapshot = session.selectionSnapshot
    const rangeSnapshot = snapshot.ranges[0]
    if (!rangeSnapshot || snapshot.ranges.length !== 1 || snapshot.textControl) return
    const word = snapshot.text.trim()
    const { words } = segmentWords(word)
    if (words.length !== 1 || words[0] !== word) return
    let range: Range
    try {
      range = toLiveRange(rangeSnapshot)
    } catch {
      return
    }
    const lang = this.scanner.languageAt(range.startContainer)
    if (lang) this.record({ lang, word }, "lookup")
  }

  // ---- marking a word known

  private markKnown(mark: DifficultWordMark, withVisible: boolean) {
    const event = this.event(mark, "known")
    this.scanner.hideLemma(mark.lang, mark.lemma)
    void sendMessage("broadcastDifficultWordLemma", {
      lang: mark.lang,
      lemma: mark.lemma,
      known: true,
    })
    if (event) {
      // The card closing judges what is on screen again; the ✓ only records.
      if (withVisible) this.scanner.refreshVisible([event])
      else void sendMessage("recordDifficultWordEvents", { events: [event] })
    }

    const toastId = toastManager.add({
      title: i18n.t("difficultWords.markedKnown"),
      timeout: UNDO_MS,
      actionProps: {
        children: i18n.t("difficultWords.undo"),
        onClick: () => {
          toastManager.close(toastId)
          if (!this.disposed) this.scanner.showLemma(mark.lang, mark.lemma)
          void sendMessage("broadcastDifficultWordLemma", {
            lang: mark.lang,
            lemma: mark.lemma,
            known: false,
          })
          if (event) {
            void sendMessage("takeBackDifficultWordEvent", { id: event.id, lang: mark.lang })
          }
        },
      },
    })
  }

  // ---- records

  private event(
    word: { lang: VocabLang; word: string },
    kind: VocabWordEventKind,
  ): VocabEvent | null {
    if (word.word.length === 0 || word.word.length > VOCAB_WORD_MAX_LENGTH) return null
    return { id: uuidv7(), lang: word.lang, kind, word: word.word, at: new Date().toISOString() }
  }

  private record(word: { lang: VocabLang; word: string }, kind: VocabWordEventKind) {
    const event = this.event(word, kind)
    if (event) void sendMessage("recordDifficultWordEvents", { events: [event] })
  }

  // ---- notices

  private askLevel(langs: VocabLang[]) {
    if (this.view.levelLang) return
    const lang = langs.find((candidate) => !this.dismissedLevels.has(candidate))
    if (lang) this.setView({ levelLang: lang })
  }

  private showFailure(failure: DifficultWordsFailure) {
    switch (failure.kind) {
      case "signedOut":
        this.signedOut = true
        showSignInRequiredNotice()
        break
      case "restricted":
        showRestrictedNotice()
        this.options.onRestricted()
        break
      case "dailyLimit":
        toastManager.add({
          id: LIMIT_TOAST_ID,
          type: "warning",
          title: i18n.t("difficultWords.dailyLimit", [formatResetTime(failure.resetAt)]),
        })
        break
      case "offline":
        toastManager.add({
          id: OFFLINE_TOAST_ID,
          type: "warning",
          title: i18n.t("difficultWords.offline"),
          timeout: 0,
        })
        break
      case "rateLimited":
      case "error":
      default:
        // Waited out, or not the reader's to fix: the scanner carries on.
        break
    }
  }

  // The sign-in notice opens another tab: coming back from it, marking
  // carries on if the reader signed in there.
  private onVisibilityChange = () => {
    if (!this.signedOut || document.visibilityState !== "visible") return
    void sendMessage("getDifficultWordsAccess", undefined)
      .then((access) => {
        if (this.disposed || !this.signedOut || access === "signedOut") return
        this.signedOut = false
        toastManager.close(SIGNED_OUT_TOAST_ID)
        if (access === "denied") {
          showRestrictedNotice()
          this.options.onRestricted()
          return
        }
        this.scanner.resume()
      })
      .catch(() => {})
  }

  // ---- the pointer

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch") return
    this.pointer = { x: event.clientX, y: event.clientY }
    if (!this.frame) this.frame = requestAnimationFrame(this.updateHover)
  }

  private updateHover = () => {
    this.frame = 0
    const pointer = this.pointer
    const mark = pointer ? this.scanner.markAt(pointer.x, pointer.y) : null
    if (mark === this.hovered) return
    this.setHovered(mark)
    if (mark) {
      this.clearTimer("hideCheckTimer")
      this.clearTimer("showCheckTimer")
      if (this.view.check?.mark !== mark) {
        this.showCheckTimer = setTimeout(() => this.showCheck(mark), CHECK_DELAY_MS)
      }
    } else {
      this.clearTimer("showCheckTimer")
      if (this.view.check && !this.overCheck) this.hideCheckSoon()
    }
  }

  private setHovered(mark: DifficultWordMark | null) {
    this.hovered = mark
    this.scanner.setHover(mark)
    document.documentElement.toggleAttribute(DIFFICULT_WORD_HOVER_ATTRIBUTE, mark !== null)
  }

  private showCheck(mark: DifficultWordMark) {
    this.showCheckTimer = null
    if (this.hovered !== mark || !this.scanner.isMarked(mark)) return
    const rect = lastLineRect(mark.range)
    this.setView({ check: { mark, rect: { right: rect.right, top: rect.top } } })
  }

  private hideCheckSoon() {
    this.clearTimer("hideCheckTimer")
    this.hideCheckTimer = setTimeout(() => {
      this.hideCheckTimer = null
      this.setView({ check: null })
    }, CHECK_DELAY_MS)
  }

  // The words moved under the pointer: what it is over is found again on its next move.
  private onScroll = () => {
    if (this.hovered) this.setHovered(null)
    this.clearTimer("showCheckTimer")
    if (this.view.check) this.setView({ check: null })
  }

  private onPointerDown = (event: PointerEvent) => {
    this.down = event.button === 0 ? { x: event.clientX, y: event.clientY } : null
  }

  // A click on a marked word opens its card, once it is clear it was one
  // click: a second one selects the word, as it would without the marks.
  // The press itself always reaches the page, so selecting still works.
  private onClick = (event: MouseEvent) => {
    if (event.button !== 0) return
    if (event.detail >= 2) {
      this.clearTimer("openTimer")
      return
    }
    const down = this.down
    this.down = null
    if (event.detail !== 1 || !down) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > CLICK_SLOP_PX) return
    if (window.getSelection()?.isCollapsed === false) return
    const passesThrough = event
      .composedPath()
      .some((node) => node instanceof Element && node.matches(PASS_THROUGH_SELECTOR))
    if (passesThrough) return
    const mark = this.scanner.markAt(event.clientX, event.clientY)
    if (!mark) return

    event.preventDefault()
    event.stopImmediatePropagation()
    this.clearTimer("openTimer")
    this.openTimer = setTimeout(() => {
      this.openTimer = null
      if (!this.disposed && this.scanner.isMarked(mark)) this.open(mark)
    }, OPEN_DELAY_MS)
  }

  private open(mark: DifficultWordMark) {
    this.clearTimer("showCheckTimer")
    if (this.view.check) this.setView({ check: null })

    if (this.options.isAnnotationMode()) {
      const session: SelectionSession = {
        id: -1,
        createdAt: Date.now(),
        selectionSnapshot: {
          text: mark.word,
          ranges: [
            {
              startContainer: mark.range.startContainer,
              startOffset: mark.range.startOffset,
              endContainer: mark.range.endContainer,
              endOffset: mark.range.endOffset,
            },
          ],
        },
        contextSnapshot: { text: this.scanner.paragraphOf(mark), paragraphs: [] },
      }
      if (this.options.annotate(session)) this.record(mark, "open")
      return
    }

    const action = resolveDifficultWordLookupAction(this.options.getConfig())
    if (action.enabled === false) {
      toastManager.add({
        type: "error",
        title: createSelectionToolbarPrecheckError("customAction", "actionUnavailable").description,
      })
      return
    }

    // Another word's card gives way to this one: that word was opened and closed.
    const previous = this.view.card
    if (previous && previous.mark !== mark) this.record(previous.mark, "open")

    this.nextCardKey += 1
    this.options.setRequest({
      actionId: action.id,
      selectionText: mark.word,
      cleanSelection: mark.word,
      contextText: this.scanner.paragraphOf(mark),
      surface: ANALYTICS_SURFACE.DIFFICULT_WORDS,
      sessionKey: this.nextCardKey,
      rerunNonce: 0,
    })
    const rect = lastLineRect(mark.range)
    this.setView({
      card: { mark, anchor: { x: rect.left, y: rect.bottom + 4 }, key: this.nextCardKey },
    })
  }

  // ---- state

  private clearTimer(name: "showCheckTimer" | "hideCheckTimer" | "openTimer") {
    const timer = this[name]
    if (timer) clearTimeout(timer)
    this[name] = null
  }

  private setView(next: Partial<DifficultWordsView>) {
    this.view = { ...this.view, ...next }
    this.notify()
  }

  private notify() {
    for (const listener of this.listeners) listener()
  }
}
