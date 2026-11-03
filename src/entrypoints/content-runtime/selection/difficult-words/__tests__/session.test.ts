// @vitest-environment jsdom
import type { VocabEvent } from "@read-frog/api-contract"
import type { Mock } from "vitest"
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
    languageAt = vi.fn<() => null>(() => null)

    constructor(host: DifficultWordsScannerHost) {
      mocks.host = host
      mocks.scanner = this
    }
  },
}))

const RECT = { left: 10, right: 60, top: 10, bottom: 30, width: 50, height: 20 } as DOMRect

function markIn(block: Element): DifficultWordMark {
  return {
    kind: "hard",
    tone: "light",
    range: { getClientRects: () => [RECT], getBoundingClientRect: () => RECT } as unknown as Range,
    word: "ubiquitous",
    lemma: "ubiquitous",
    lang: "eng",
    block,
  }
}

function createSession() {
  const session = new DifficultWordsSession("cmn", {
    getConfig: () => ({}) as Config,
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

    host.onNeedsLevel(["fra", "deu"], performance.now())
    host.onNeedsLevel(["spa"], performance.now())
    expect(session.getView().levelLang).toBe("fra")

    session.dismissLevel()
    expect(session.getView().levelLang).toBe("deu")
    const sentBefore = performance.now()
    await vi.advanceTimersByTimeAsync(10)
    await session.pickLevel("B1")
    expect(mocks.setLevel).toHaveBeenCalledWith({ lang: "deu", level: "B1" })
    expect(mocks.scanner!.retryLevel).toHaveBeenCalledWith("deu")
    expect(session.getView().levelLang).toBe("spa")

    // A request out while the level was saved: its paragraphs go again, nothing is asked.
    host.onNeedsLevel(["deu", "fra"], sentBefore)
    expect(mocks.scanner!.retryLevel).toHaveBeenCalledTimes(2)
    expect(session.getView().levelLang).toBe("spa")

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
    expect(recorded()).toEqual([expect.objectContaining({ kind: "save", word: "ubiquitous" })])
  })

  it("undoes the card's I know it by judging the paragraphs on screen again with the undo", async () => {
    session = createSession()
    const mark = markIn(document.querySelector("#a")!)
    await openCard(mark)
    expect(session.getView().card?.mark).toBe(mark)

    session.markCardKnown()
    const known = mocks.scanner!.refreshVisible.mock.calls[0]![0][0]!
    expect(known).toMatchObject({ kind: "known", word: "ubiquitous" })
    undoLast()

    expect(mocks.scanner!.showLemma).toHaveBeenCalledWith("eng", "ubiquitous")
    expect(mocks.scanner!.refreshVisible).toHaveBeenLastCalledWith([
      expect.objectContaining({ kind: "undo", lang: "eng", target: known.id }),
    ])
    expect(recorded()).toEqual([])
  })

  it("undoes the ✓ by recording the undo alone", async () => {
    session = createSession()
    const mark = markIn(document.querySelector("#a")!)
    await hover(mark)
    await vi.advanceTimersByTimeAsync(300)
    expect(session.getView().check?.mark).toBe(mark)

    session.markCheckKnown()
    const [known] = recorded()
    undoLast()

    expect(recorded()).toEqual([
      known,
      expect.objectContaining({ kind: "undo", lang: "eng", target: known!.id }),
    ])
    expect(mocks.scanner!.refreshVisible).not.toHaveBeenCalled()
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
