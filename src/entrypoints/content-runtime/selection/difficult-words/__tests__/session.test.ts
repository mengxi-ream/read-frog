// @vitest-environment jsdom
import type { VocabEvent, VocabLang, VocabSeen } from "@read-frog/api-contract"
import type { LanguageTag } from "@read-frog/definitions"
import type { Mock } from "vitest"
import type { SelectionSession } from "../../selection-toolbar/atoms"
import type { Config } from "@/types/config/config"
import type { DifficultWordMark, DifficultWordsScannerHost } from "@/utils/difficult-words/scanner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DIFFICULT_WORD_HOVER_ATTRIBUTE } from "@/utils/difficult-words/styles"
import { DifficultWordsSession } from "../session"

interface Toast {
  actionProps?: { onClick: () => void }
}

/** What the tests look at of the scanner the session made. */
interface FakeScanner {
  showLemma: Mock<(lang: string, lemma: string) => void>
  refreshVisible: Mock<(events: VocabEvent[]) => void>
  retryLevel: Mock<(lang: string) => void>
  noteSeen: Mock<(mark: DifficultWordMark) => void>
  markForSelection: Mock<(range: Range, word: string) => DifficultWordMark | null>
  languageAt: Mock<(node: Node) => VocabLang | null>
}

const mocks = vi.hoisted(() => ({
  sendMessage: vi.fn<(...args: any[]) => Promise<unknown>>(() => Promise.resolve()),
  setLevel: vi.fn<(input: unknown) => Promise<void>>(() => Promise.resolve()),
  toastAdd: vi.fn<(toast: Toast) => string>(() => "toast"),
  host: null as DifficultWordsScannerHost | null,
  scanner: null as FakeScanner | null,
  markAt: null as unknown,
}))

vi.mock("@/utils/message", () => ({ sendMessage: mocks.sendMessage }))
vi.mock("@/utils/orpc/client", () => ({ orpcClient: { vocab: { setLevel: mocks.setLevel } } }))
vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: mocks.toastAdd, close: vi.fn<(id: string) => void>() },
}))
vi.mock("@/utils/i18n", () => ({ i18n: { t: (key: string) => key } }))
vi.mock("@/utils/error-action", () => ({ logInUrl: () => "https://example.com/log-in" }))
vi.mock("@/components/ui/selection-popover/inline-error", () => ({
  createSelectionToolbarPrecheckError: () => ({ description: "unavailable" }),
}))
vi.mock("@/utils/custom-actions", () => ({
  resolveDifficultWordLookupAction: () => ({ id: "dictionary", enabled: true }),
}))
vi.mock("@/utils/difficult-words/scanner", () => ({
  DifficultWordsScanner: class {
    count = 0
    start = vi.fn<() => void>()
    dispose = vi.fn<() => void>()
    resume = vi.fn<() => void>()
    setHover = vi.fn<(mark: unknown) => void>()
    hideLemma = vi.fn<(lang: string, lemma: string) => void>()
    showLemma = vi.fn<(lang: string, lemma: string) => void>()
    refreshVisible = vi.fn<(events: VocabEvent[]) => void>()
    retryLevel = vi.fn<(lang: string) => void>()
    markAt = vi.fn<() => unknown>(() => mocks.markAt)
    isMarked = vi.fn<() => boolean>(() => true)
    paragraphOf = vi.fn<() => string>(() => "The ubiquitous cat.")
    languageAt = vi.fn<(node: Node) => VocabLang | null>(() => null)
    noteSeen = vi.fn<(mark: DifficultWordMark) => void>()
    markForSelection = vi.fn<(range: Range, word: string) => DifficultWordMark | null>(() => null)

    constructor(host: DifficultWordsScannerHost) {
      mocks.host = host
      mocks.scanner = this
    }
  },
}))

const RECT = { left: 10, right: 60, top: 10, bottom: 30, width: 50, height: 20 } as DOMRect

function markIn(block: Element): DifficultWordMark {
  return {
    tone: "light",
    range: { getClientRects: () => [RECT], getBoundingClientRect: () => RECT } as unknown as Range,
    word: "ubiquitous",
    lemma: "ubiquitous",
    lang: "en",
    v: 1,
    block,
  }
}

/** The reader selected `text` of `element`'s text from `start`, and looked it up. */
function selectionOf(element: Element, start: number, text: string): SelectionSession {
  const node = element.firstChild!
  return {
    id: 1,
    createdAt: Date.now(),
    selectionSnapshot: {
      text,
      ranges: [
        {
          startContainer: node,
          startOffset: start,
          endContainer: node,
          endOffset: start + text.length,
        },
      ],
    },
    contextSnapshot: { text: element.textContent ?? "", paragraphs: [] },
    noteOrigin: null,
  }
}

/** The target language in the settings, as `getConfig` reads it. */
let targetCode: LanguageTag = "zh-Hans"

function createSession() {
  const session = new DifficultWordsSession({
    getConfig: () => ({ language: { targetCode } }) as Config,
    setRequest: vi.fn<(request: unknown) => void>(),
    isAnnotationMode: () => false,
    annotate: () => false,
    onRestricted: vi.fn<() => void>(),
    onCountChange: vi.fn<(count: number) => void>(),
  })
  session.start()
  return session
}

/** The records sent on their own, flattened. */
function recorded(): VocabEvent[] {
  return mocks.sendMessage.mock.calls
    .filter(([type]) => type === "recordDifficultWordEvents")
    .flatMap(([, data]) => (data as { events: VocabEvent[] }).events)
}

/** Clicks the marked word under the pointer: its card opens once it is clear it was one click. */
async function openCard(mark: DifficultWordMark) {
  mocks.markAt = mark
  window.dispatchEvent(new MouseEvent("pointerdown", { button: 0, clientX: 20, clientY: 20 }))
  window.dispatchEvent(new MouseEvent("click", { button: 0, detail: 1, clientX: 20, clientY: 20 }))
  await vi.advanceTimersByTimeAsync(300)
}

/** Rests the pointer on the marked word until its ✓ shows. */
async function hover(mark: DifficultWordMark | null) {
  mocks.markAt = mark
  window.dispatchEvent(new MouseEvent("pointermove", { clientX: 20, clientY: 20 }))
  await vi.advanceTimersByTimeAsync(16)
}

/** Presses Undo on the last notice. */
function undoLast() {
  const toast = mocks.toastAdd.mock.calls.at(-1)![0]
  toast.actionProps!.onClick()
}

let session: DifficultWordsSession | null = null

beforeEach(() => {
  targetCode = "zh-Hans"
  vi.useFakeTimers()
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 16),
  )
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => clearTimeout(handle))
  document.body.innerHTML = "<p id='a'>The ubiquitous cat.</p>"
})

afterEach(() => {
  session?.dispose()
  session = null
  mocks.markAt = null
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.body.replaceChildren()
})

describe("DifficultWordsSession", () => {
  it("asks each language's level in turn, and judges again what was judged before one was saved", async () => {
    session = createSession()
    const host = mocks.host!

    host.onNeedsLevel(["fr", "de"], performance.now())
    host.onNeedsLevel(["es"], performance.now())
    expect(session.getView().levelLang).toBe("fr")

    session.dismissLevel()
    expect(session.getView().levelLang).toBe("de")
    const sentBefore = performance.now()
    await vi.advanceTimersByTimeAsync(10)
    await session.pickLevel("B1")
    expect(mocks.setLevel).toHaveBeenCalledWith({ lang: "de", level: "B1" })
    expect(mocks.scanner!.retryLevel).toHaveBeenCalledWith("de")
    expect(session.getView().levelLang).toBe("es")

    // A request out while the level was saved: its paragraphs go again, nothing is asked.
    host.onNeedsLevel(["de", "fr"], sentBefore)
    expect(mocks.scanner!.retryLevel).toHaveBeenCalledTimes(2)
    expect(session.getView().levelLang).toBe("es")

    session.dismissLevel()
    expect(session.getView().levelLang).toBeNull()
  })

  it("records a save only once it is made, for the word it was made for", () => {
    session = createSession()
    const mark = markIn(document.querySelector("#a")!)

    session.onCardSave(mark, "dialog_opened")
    session.onCardSave(mark, "failed")
    expect(recorded()).toEqual([])

    session.onCardSave(mark, "saved")
    expect(recorded()).toEqual([
      expect.objectContaining({
        kind: "save",
        lang: "en",
        word: "ubiquitous",
        lemma: "ubiquitous",
        hl: 1,
      }),
    ])
  })

  it("undoes the card's I know it by judging the paragraphs on screen again with the undo", async () => {
    session = createSession()
    const mark = markIn(document.querySelector("#a")!)
    await openCard(mark)
    expect(session.getView().card?.mark).toBe(mark)
    expect(mocks.scanner!.noteSeen).toHaveBeenCalledWith(mark)

    session.markCardKnown()
    const known = mocks.scanner!.refreshVisible.mock.calls[0]![0][0]!
    expect(known).toMatchObject({ kind: "known", word: "ubiquitous", lemma: "ubiquitous", hl: 1 })
    undoLast()

    expect(mocks.scanner!.showLemma).toHaveBeenCalledWith("en", "ubiquitous")
    expect(mocks.scanner!.refreshVisible).toHaveBeenLastCalledWith([
      expect.objectContaining({ kind: "undo", lang: "en", target: known.id }),
    ])
    expect(recorded()).toEqual([])
  })

  it("leaves a click on a word in a control to the control, whether native or by its role", async () => {
    document.body.innerHTML = `
      <p id="a">The ubiquitous cat.</p>
      <a href="#" id="link">The ubiquitous cat.</a>
      <div role="tab"><span id="tab">The ubiquitous cat.</span></div>
      <ul role="listbox"><li role="option" id="option">The ubiquitous cat.</li></ul>`
    session = createSession()

    const results: Record<string, { prevented: boolean; opened: boolean }> = {}
    for (const id of ["link", "tab", "option", "a"]) {
      const target = document.querySelector(`#${id}`)!
      mocks.markAt = markIn(target)
      window.dispatchEvent(new MouseEvent("pointerdown", { button: 0, clientX: 20, clientY: 20 }))
      const click = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
        detail: 1,
        clientX: 20,
        clientY: 20,
      })
      target.dispatchEvent(click)
      await vi.advanceTimersByTimeAsync(300)

      results[id] = {
        prevented: click.defaultPrevented,
        opened: session.getView().card?.mark.block === target,
      }
    }

    expect(results).toEqual({
      link: { prevented: false, opened: false },
      tab: { prevented: false, opened: false },
      option: { prevented: false, opened: false },
      a: { prevented: true, opened: true },
    })
  })

  it("undoes the ✓ by recording the undo alone", async () => {
    session = createSession()
    const mark = markIn(document.querySelector("#a")!)
    await hover(mark)
    await vi.advanceTimersByTimeAsync(300)
    expect(session.getView().check?.mark).toBe(mark)

    expect(mocks.scanner!.noteSeen).not.toHaveBeenCalled()
    session.markCheckKnown()
    expect(mocks.scanner!.noteSeen).toHaveBeenCalledWith(mark)
    const [known] = recorded()
    undoLast()

    expect(recorded()).toEqual([
      known,
      expect.objectContaining({ kind: "undo", lang: "en", target: known!.id }),
    ])
    expect(mocks.scanner!.refreshVisible).not.toHaveBeenCalled()
  })

  it("still hides the next word's ✓ when the pointer leaves it, after a ✓ was pressed", async () => {
    session = createSession()
    const block = document.querySelector("#a")!
    await hover(markIn(block))
    await vi.advanceTimersByTimeAsync(300)
    // Pressed: the ✓ goes away under the pointer, which never leaves it.
    session.checkPointerEnter()
    session.markCheckKnown()

    const next = markIn(block)
    await hover(next)
    await vi.advanceTimersByTimeAsync(300)
    expect(session.getView().check?.mark).toBe(next)
    await hover(null)
    await vi.advanceTimersByTimeAsync(300)
    expect(session.getView().check).toBeNull()
  })

  it("records a marked word looked up under its lemma, and counts it seen; another word by its paragraph's language", () => {
    session = createSession()
    const block = document.querySelector("#a")!
    const mark = markIn(block)
    mocks.scanner!.markForSelection.mockImplementation((_range, word) =>
      word === mark.word ? mark : null,
    )
    mocks.scanner!.languageAt.mockReturnValue("en")

    session.onSelectionLookup(selectionOf(block, 4, "ubiquitous"))
    session.onSelectionLookup(selectionOf(block, 15, "cat"))
    // More than one word.
    session.onSelectionLookup(selectionOf(block, 4, "ubiquitous cat"))

    expect(mocks.scanner!.noteSeen).toHaveBeenCalledTimes(1)
    expect(mocks.scanner!.noteSeen).toHaveBeenCalledWith(mark)
    const [marked, other] = recorded()
    expect(recorded()).toHaveLength(2)
    expect(marked).toMatchObject({
      kind: "lookup",
      lang: "en",
      word: "ubiquitous",
      lemma: "ubiquitous",
      hl: 1,
    })
    expect(other).toMatchObject({ kind: "lookup", lang: "en", word: "cat" })
    expect(other).not.toHaveProperty("lemma")
    expect(other).not.toHaveProperty("hl")
  })

  it("sends the reader's own language with each request, and the words seen to the background", async () => {
    session = createSession()
    const host = mocks.host!
    const seen: VocabSeen[] = [{ lang: "en", v: 2, words: ["ubiquitous"] }]

    await host.judge([{ id: "b1", text: "The ubiquitous cat." }])
    host.seen(seen)

    expect(mocks.sendMessage).toHaveBeenCalledWith("judgeDifficultWords", {
      own: "zh-Hans",
      blocks: [{ id: "b1", text: "The ubiquitous cat." }],
      events: undefined,
    })
    expect(mocks.sendMessage).toHaveBeenCalledWith("recordDifficultWordsSeen", { seen })
  })

  it("sends the target language the settings have now, not the one marking was started with", async () => {
    session = createSession()
    const host = mocks.host!

    await host.judge([{ id: "b1", text: "The ubiquitous cat." }])
    targetCode = "es"
    await host.judge([{ id: "b2", text: "The ubiquitous dog." }])

    const owns = mocks.sendMessage.mock.calls
      .filter(([type]) => type === "judgeDifficultWords")
      .map(([, data]) => (data as { own: string }).own)
    expect(owns).toEqual(["zh-Hans", "es"])
  })

  it("gives the pointer cursor to the hovered word's paragraph, not the page", async () => {
    session = createSession()
    const block = document.querySelector("#a")!

    await hover(markIn(block))
    expect(block.hasAttribute(DIFFICULT_WORD_HOVER_ATTRIBUTE)).toBe(true)
    expect(document.documentElement.hasAttribute(DIFFICULT_WORD_HOVER_ATTRIBUTE)).toBe(false)

    await hover(null)
    expect(block.hasAttribute(DIFFICULT_WORD_HOVER_ATTRIBUTE)).toBe(false)
  })
})
