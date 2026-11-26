// @vitest-environment jsdom
import type { VocabEvent, VocabJudgeBlock, VocabJudgeOutput } from "@read-frog/api-contract"
import type { DifficultWordsScannerHost } from "../scanner"
import type { DifficultWordsJudgeResponse } from "../types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BlockDiscovery } from "../blocks"
import { DifficultWordsScanner } from "../scanner"

// The sheet is adopted into the document, which jsdom cannot do.
vi.mock("../styles", () => ({
  ensureDifficultWordsDocumentStyles: vi.fn<() => void>(),
  removeDifficultWordsDocumentStyles: vi.fn<() => void>(),
}))

class FakeIntersectionObserver {
  static latest: FakeIntersectionObserver | null = null
  readonly observed = new Set<Element>()

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.latest = this
  }

  observe(element: Element) {
    this.observed.add(element)
  }

  unobserve(element: Element) {
    this.observed.delete(element)
  }

  disconnect() {
    this.observed.clear()
  }

  takeRecords() {
    return []
  }

  /** Brings `elements` within a screen of the viewport, or takes them away. */
  fire(elements: Element[], isIntersecting = true) {
    this.callback(
      elements.map((target) => ({ target, isIntersecting }) as IntersectionObserverEntry),
      this as unknown as IntersectionObserver,
    )
  }
}

class FakeHighlight {
  priority = 0
  readonly ranges = new Set<AbstractRange>()

  add(range: AbstractRange) {
    this.ranges.add(range)
    return this
  }

  delete(range: AbstractRange) {
    return this.ranges.delete(range)
  }

  clear() {
    this.ranges.clear()
  }
}

const registry = new Map<string, FakeHighlight>()

/** The words painted in a highlight, in the order they were added. */
function painted(name = "read-frog-hard") {
  return [...(registry.get(name)?.ranges ?? [])].map((range) => (range as Range).toString())
}

function $(selector: string) {
  return document.querySelector(selector)!
}

type Judge = (
  blocks: VocabJudgeBlock[],
) => DifficultWordsJudgeResponse | Promise<DifficultWordsJudgeResponse>

function createHost(judge: Judge) {
  return {
    judge: vi.fn<DifficultWordsScannerHost["judge"]>(async (blocks) => judge(blocks)),
    record: vi.fn<DifficultWordsScannerHost["record"]>(),
    onNeedsLevel: vi.fn<DifficultWordsScannerHost["onNeedsLevel"]>(),
    onFailure: vi.fn<DifficultWordsScannerHost["onFailure"]>(),
    onRecovered: vi.fn<DifficultWordsScannerHost["onRecovered"]>(),
    onMarksChange: vi.fn<DifficultWordsScannerHost["onMarksChange"]>(),
    seen: vi.fn<DifficultWordsScannerHost["seen"]>(),
    onEmpty: vi.fn<DifficultWordsScannerHost["onEmpty"]>(),
  } satisfies DifficultWordsScannerHost
}

function answer(
  blocks: VocabJudgeOutput["blocks"],
  needsLevel: VocabJudgeOutput["needsLevel"] = [],
): DifficultWordsJudgeResponse {
  return { ok: true, output: { acked: [], blocks, needsLevel } }
}

/** The words of `text` among `wanted`, each once with every place it starts, as the server gives them. */
function findWords(text: string, wanted: string[]) {
  const found = new Map<string, number[]>()
  for (const match of text.matchAll(/\p{L}+/gu)) {
    if (!wanted.includes(match[0].toLowerCase())) continue
    found.set(match[0], [...(found.get(match[0]) ?? []), match.index])
  }
  return [...found].map(([w, at]) => ({ w, lemma: w.toLowerCase(), at }))
}

/** Judges every block as English, marking the words of `hard` where they are in the text sent. */
function judgeHard(hard: string[], v: number | (() => number) = 1): Judge {
  return (blocks) =>
    answer(
      blocks.map((block) => ({
        id: block.id,
        lang: "en",
        v: typeof v === "function" ? v() : v,
        hard: findWords(block.text, hard),
      })),
    )
}

function failing(failure: Extract<DifficultWordsJudgeResponse, { ok: false }>["failure"]): Judge {
  return () => ({ ok: false, failure })
}

function sentIds(host: ReturnType<typeof createHost>, call: number) {
  return host.judge.mock.calls[call]![0].map((block) => block.id)
}

async function startScanner(host: DifficultWordsScannerHost) {
  const scanner = new DifficultWordsScanner(host)
  scanner.start()
  // Paragraphs are found in idle time.
  await vi.advanceTimersByTimeAsync(50)
  return { scanner, observer: FakeIntersectionObserver.latest! }
}

/** Past the short wait that gathers paragraphs coming near into one request. */
async function flush() {
  await vi.advanceTimersByTimeAsync(100)
}

/** Runs what was set for "now": a timer set to 0 while timers run comes due a millisecond later. */
async function settle() {
  await vi.advanceTimersByTimeAsync(1)
}

const PARAGRAPH = "The ubiquitous cat sat on the ubiquitous mat."

const KNOWN: VocabEvent = {
  id: "0190f5c6-2d0c-7000-8000-000000000001",
  lang: "en",
  kind: "known",
  word: "ubiquitous",
  at: "2026-11-03T00:00:00.000Z",
}

/** Puts `element` on screen, as far as the scanner can tell. */
function onScreen(element: Element) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    top: 0,
    bottom: 20,
    left: 0,
    right: 100,
    width: 100,
    height: 20,
  } as DOMRect)
}

/** Takes `element` off screen, below the viewport. */
function offScreen(element: Element) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    top: 2000,
    bottom: 2020,
    left: 0,
    right: 100,
    width: 100,
    height: 20,
  } as DOMRect)
}

/** The text of `element` from `start` to `end`, as a selection would be. */
function rangeIn(element: Element, start: number, end: number) {
  const range = document.createRange()
  range.setStart(element.firstChild!, start)
  range.setEnd(element.firstChild!, end)
  return range
}

/** A promise held until `release` is called. */
function hold() {
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  return { held, release }
}

let scanner: DifficultWordsScanner | null = null
let page = 0

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver)
  vi.stubGlobal("Highlight", FakeHighlight)
  vi.stubGlobal("CSS", { highlights: registry })
  // jsdom lays nothing out and gives ranges no rect: a word is where its paragraph is.
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value(this: Range) {
      return (this.startContainer.parentElement ?? document.body).getBoundingClientRect()
    },
  })
  // A page of its own for each test: the words seen are counted once a page.
  page += 1
  history.replaceState(null, "", `/page-${page}`)
})

afterEach(() => {
  scanner?.dispose()
  scanner = null
  registry.clear()
  document.body.replaceChildren()
  Reflect.deleteProperty(Range.prototype, "getBoundingClientRect")
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("DifficultWordsScanner", () => {
  it("sends the paragraphs coming near the viewport and marks the hard words in them", async () => {
    document.body.innerHTML = `<p id="a">${PARAGRAPH}</p><p id="b">Far below.</p>`
    const host = createHost(judgeHard(["ubiquitous"]))
    const started = await startScanner(host)
    scanner = started.scanner
    expect(started.observer.observed).toEqual(new Set([$("#a"), $("#b")]))

    started.observer.fire([$("#a")])
    await flush()

    expect(host.judge).toHaveBeenCalledTimes(1)
    expect(host.judge.mock.calls[0]![0]).toEqual([
      { id: "b1", text: PARAGRAPH, group: expect.any(String) },
    ])
    expect(painted()).toEqual(["ubiquitous", "ubiquitous"])
    expect(scanner.count).toBe(1)
    expect(host.onMarksChange).toHaveBeenCalled()
  })

  it("says so when the page has nothing to read", async () => {
    document.body.innerHTML = "<pre>const x = 1</pre><p> </p>"
    const host = createHost(judgeHard([]))
    scanner = (await startScanner(host)).scanner

    expect(host.onEmpty).toHaveBeenCalledTimes(1)
  })

  it("groups neighbouring paragraphs, for the short ones to be detected together, the nearest first", async () => {
    document.body.innerHTML = "<ul><li id='a'>One cat</li><li id='b'>Two dogs</li></ul>"
    const host = createHost(judgeHard([]))
    const started = await startScanner(host)
    scanner = started.scanner
    const rect = (top: number) => ({
      top,
      bottom: top + 20,
      left: 0,
      right: 100,
      width: 100,
      height: 20,
    })
    vi.spyOn($("#a"), "getBoundingClientRect").mockReturnValue(rect(2000) as DOMRect)
    vi.spyOn($("#b"), "getBoundingClientRect").mockReturnValue(rect(100) as DOMRect)

    started.observer.fire([$("#a"), $("#b")])
    await flush()

    const [sent] = host.judge.mock.calls[0]!
    expect(sent.map((block) => block.id)).toEqual(["b2", "b1"])
    expect(sent[0]!.group).toBeDefined()
    expect(sent[0]!.group).toBe(sent[1]!.group)
  })

  it("marks a word only where it really starts in the text sent", async () => {
    const text = "我们讨论了量子纠缠的问题，量子纠缠很难。"
    document.body.innerHTML = `<p id="a" lang="zh-CN">${text}</p>`
    const host = createHost((blocks) =>
      answer([
        {
          id: blocks[0]!.id,
          lang: "zh-Hans",
          v: 1,
          hard: [{ w: "量子纠缠", lemma: "量子纠缠", at: [5, 2, 13, 40] }],
        },
      ]),
    )
    const started = await startScanner(host)
    scanner = started.scanner

    started.observer.fire([$("#a")])
    await flush()

    expect(host.judge.mock.calls[0]![0]).toEqual([
      { id: "b1", text, hint: "zh-CN", group: expect.any(String) },
    ])
    expect(painted()).toEqual(["量子纠缠", "量子纠缠"])
    expect(scanner.languageAt($("#a").firstChild!)).toBe("zh-Hans")
  })

  it("unmarks a word the reader knows in every paragraph, and marks it again on undo", async () => {
    document.body.innerHTML = `<p id="a">${PARAGRAPH}</p><p id="b">Ubiquitous mats everywhere around.</p>`
    const host = createHost(judgeHard(["ubiquitous"]))
    const started = await startScanner(host)
    scanner = started.scanner
    started.observer.fire([$("#a"), $("#b")])
    await flush()
    expect(painted()).toHaveLength(3)

    scanner.hideLemma("en", "ubiquitous")

    expect(painted()).toEqual([])
    expect(scanner.count).toBe(0)

    scanner.showLemma("en", "ubiquitous")

    expect(painted()).toHaveLength(3)
  })

  it("keeps a known word unmarked when its paragraph is judged again", async () => {
    document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
    const host = createHost(judgeHard(["ubiquitous", "cat"]))
    const started = await startScanner(host)
    scanner = started.scanner
    started.observer.fire([$("#a")])
    await flush()
    scanner.hideLemma("en", "ubiquitous")

    $("#a").firstChild!.textContent = "A ubiquitous cat again."
    await vi.advanceTimersByTimeAsync(100)
    await flush()

    expect(host.judge).toHaveBeenCalledTimes(2)
    expect(painted()).toEqual(["cat"])
  })

  it("sends a paragraph again when its text changes, and repaints it without asking when only its nodes do", async () => {
    document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
    const host = createHost(judgeHard(["ubiquitous", "dog"]))
    const started = await startScanner(host)
    scanner = started.scanner
    started.observer.fire([$("#a")])
    await flush()

    ;($("#a").firstChild as Text).data = "The ubiquitous dog."
    await vi.advanceTimersByTimeAsync(100)
    await flush()

    expect(host.judge).toHaveBeenCalledTimes(2)
    expect(host.judge.mock.calls[1]![0]).toEqual([
      { id: "b1", text: "The ubiquitous dog.", group: expect.any(String) },
    ])
    expect(painted()).toEqual(["ubiquitous", "dog"])

    $("#a").replaceChildren("The ", "ubiquitous", " dog.")
    await vi.advanceTimersByTimeAsync(100)
    await flush()

    expect(host.judge).toHaveBeenCalledTimes(2)
    expect(painted()).toEqual(["ubiquitous", "dog"])
    const [range] = registry.get("read-frog-hard")!.ranges
    expect((range as Range).startContainer).toBe($("#a").childNodes[1])
  })

  it("sends again a paragraph that changed while it was being judged", async () => {
    document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
    let release!: () => void
    const first = new Promise<void>((resolve) => {
      release = resolve
    })
    const judge = judgeHard(["ubiquitous", "dog"])
    const host = createHost(async (blocks) => {
      if (host.judge.mock.calls.length === 1) await first
      return judge(blocks)
    })
    const started = await startScanner(host)
    scanner = started.scanner
    started.observer.fire([$("#a")])
    await flush()

    $("#a").replaceChildren("The ubiquitous dog.")
    await vi.advanceTimersByTimeAsync(100)
    release()
    await vi.advanceTimersByTimeAsync(100)
    await flush()

    expect(host.judge).toHaveBeenCalledTimes(2)
    expect(host.judge.mock.calls[1]![0][0]!.text).toBe("The ubiquitous dog.")
    expect(painted()).toEqual(["ubiquitous", "dog"])
  })

  it("judges again the paragraphs judged with a threshold that has since moved", async () => {
    document.body.innerHTML = `<p id="a">${PARAGRAPH}</p><p id="b">${PARAGRAPH}</p><p id="c">${PARAGRAPH}</p>`
    let version = 1
    const host = createHost(judgeHard(["ubiquitous"], () => version))
    const started = await startScanner(host)
    scanner = started.scanner
    started.observer.fire([$("#a"), $("#b")])
    await flush()
    expect(sentIds(host, 0)).toEqual(["b1", "b2"])

    version = 2
    started.observer.fire([$("#c")])
    await flush()
    await settle()

    expect(sentIds(host, 1)).toEqual(["b3"])
    expect(sentIds(host, 2)).toEqual(["b1", "b2"])
    expect(host.judge).toHaveBeenCalledTimes(3)
  })

  it("sends the reader's records with the judged paragraphs on screen, or alone when there are none", async () => {
    document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
    const host = createHost(judgeHard(["ubiquitous"]))
    const started = await startScanner(host)
    scanner = started.scanner
    const event: VocabEvent = {
      id: "0190f5c6-2d0c-7000-8000-000000000001",
      lang: "en",
      kind: "known",
      word: "ubiquitous",
      at: "2026-11-03T00:00:00.000Z",
    }

    scanner.refreshVisible([event])
    expect(host.record).toHaveBeenCalledWith([event])

    started.observer.fire([$("#a")])
    await flush()
    vi.spyOn($("#a"), "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 20,
      left: 0,
      right: 100,
      width: 100,
      height: 20,
    } as DOMRect)
    scanner.refreshVisible([event])
    await settle()

    expect(host.judge).toHaveBeenCalledTimes(2)
    expect(host.judge.mock.calls[1]).toEqual([[expect.objectContaining({ id: "b1" })], [event]])
    expect(host.record).toHaveBeenCalledTimes(1)
  })

  it("sends again, with the records, a paragraph on screen still on its way, and keeps only that answer", async () => {
    document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
    const card = hold()
    const withWord = judgeHard(["ubiquitous"])
    const host = createHost(async (blocks) => {
      // The card's request, judged before the undo: it comes back last.
      if (host.judge.mock.calls.length === 2) {
        await card.held
        return judgeHard([])(blocks)
      }
      return withWord(blocks)
    })
    const started = await startScanner(host)
    scanner = started.scanner
    started.observer.fire([$("#a")])
    await flush()
    onScreen($("#a"))
    const undo: VocabEvent = {
      id: "0190f5c6-2d0c-7000-8000-000000000002",
      lang: "en",
      kind: "undo",
      target: KNOWN.id,
      at: "2026-11-03T00:00:01.000Z",
    }

    scanner.refreshVisible([KNOWN])
    await settle()
    scanner.refreshVisible([undo])
    await settle()

    expect(host.judge).toHaveBeenCalledTimes(3)
    expect(host.judge.mock.calls[2]).toEqual([[expect.objectContaining({ id: "b1" })], [undo]])
    card.release()
    await settle()
    expect(painted()).toEqual(["ubiquitous", "ubiquitous"])
  })

  it("drops the answer for a paragraph the page removed while it was being judged", async () => {
    document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
    const answerHeld = hold()
    const judge = judgeHard(["ubiquitous"])
    const host = createHost(async (blocks) => {
      await answerHeld.held
      return judge(blocks)
    })
    const started = await startScanner(host)
    scanner = started.scanner
    started.observer.fire([$("#a")])
    await flush()

    $("#a").remove()
    await vi.advanceTimersByTimeAsync(100)
    answerHeld.release()
    await settle()

    expect(painted()).toEqual([])
    expect(scanner.count).toBe(0)
  })

  it("watches the paragraphs a page adds, not the elements they are added to", async () => {
    document.body.innerHTML = `<div id="feed"><p id="a">${PARAGRAPH}</p></div><p id="blank"> </p>`
    const host = createHost(judgeHard(["ubiquitous"]))
    const started = await startScanner(host)
    scanner = started.scanner
    expect(started.observer.observed).toEqual(new Set([$("#a")]))

    const item = document.createElement("p")
    item.id = "b"
    item.textContent = PARAGRAPH
    $("#feed").append(item)
    document.body.append(document.createElement("div"))
    ;($("#blank").firstChild as Text).data = PARAGRAPH
    await vi.advanceTimersByTimeAsync(100)

    expect(started.observer.observed).toEqual(new Set([$("#a"), $("#b"), $("#blank")]))
  })

  it("reads the new body a page swaps in to navigate, and lets go of the old one's marks", async () => {
    document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
    const host = createHost(judgeHard(["ubiquitous", "dog"]))
    const started = await startScanner(host)
    scanner = started.scanner
    started.observer.fire([$("#a")])
    await flush()
    expect(scanner.count).toBe(1)
    host.onMarksChange.mockClear()

    const next = document.createElement("body")
    next.innerHTML = `<p id="b">The ubiquitous dog.</p>`
    document.documentElement.replaceChild(next, document.body)
    await vi.advanceTimersByTimeAsync(100)

    expect(painted()).toEqual([])
    expect(scanner.count).toBe(0)
    expect(host.onMarksChange).toHaveBeenCalled()
    expect(started.observer.observed.has($("#b"))).toBe(true)

    started.observer.fire([$("#b")])
    await flush()
    expect(host.judge.mock.calls[1]![0][0]!.text).toBe("The ubiquitous dog.")
    expect(painted()).toEqual(["ubiquitous", "dog"])
  })

  it("asks for a level, and judges the paragraphs waiting for it once it is given", async () => {
    document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
    let hasLevel = false
    const judge = judgeHard(["ubiquitous"])
    const host = createHost((blocks) =>
      hasLevel ? judge(blocks) : answer([{ id: blocks[0]!.id, lang: "en", skip: "level" }], ["en"]),
    )
    const started = await startScanner(host)
    scanner = started.scanner
    started.observer.fire([$("#a")])
    await flush()
    expect(host.onNeedsLevel).toHaveBeenCalledWith(["en"], expect.any(Number))
    expect(painted()).toEqual([])

    hasLevel = true
    scanner.retryLevel("en")
    await settle()

    expect(host.judge).toHaveBeenCalledTimes(2)
    expect(painted()).toEqual(["ubiquitous", "ubiquitous"])
  })

  describe("when a request fails", () => {
    it("stops asking while signed out, and picks up again when resumed", async () => {
      document.body.innerHTML = `<p id="a">${PARAGRAPH}</p><p id="b">${PARAGRAPH}</p>`
      let signedIn = false
      const judge = judgeHard(["ubiquitous"])
      const host = createHost((blocks) =>
        signedIn ? judge(blocks) : { ok: false, failure: { kind: "signedOut" } },
      )
      const started = await startScanner(host)
      scanner = started.scanner
      started.observer.fire([$("#a")])
      await flush()
      expect(host.onFailure).toHaveBeenCalledWith({ kind: "signedOut" })

      started.observer.fire([$("#b")])
      await vi.advanceTimersByTimeAsync(60_000)
      expect(host.judge).toHaveBeenCalledTimes(1)

      signedIn = true
      scanner.resume()
      await settle()

      expect(host.judge).toHaveBeenCalledTimes(2)
      expect(sentIds(host, 1)).toEqual(["b1", "b2"])
      expect(host.onRecovered).toHaveBeenCalledTimes(1)
    })

    it("tries again on its own when offline, waiting longer each time", async () => {
      document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
      const host = createHost(failing({ kind: "offline" }))
      const started = await startScanner(host)
      scanner = started.scanner
      started.observer.fire([$("#a")])
      await flush()
      expect(host.judge).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(1_999)
      expect(host.judge).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(host.judge).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(9_999)
      expect(host.judge).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(1)
      expect(host.judge).toHaveBeenCalledTimes(3)
    })

    it("tries again at once when the connection comes back", async () => {
      document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
      let online = false
      const judge = judgeHard(["ubiquitous"])
      const host = createHost((blocks) =>
        online ? judge(blocks) : { ok: false, failure: { kind: "offline" } },
      )
      const started = await startScanner(host)
      scanner = started.scanner
      started.observer.fire([$("#a")])
      await flush()
      expect(host.judge).toHaveBeenCalledTimes(1)

      online = true
      window.dispatchEvent(new Event("online"))
      await settle()

      expect(host.judge).toHaveBeenCalledTimes(2)
      expect(painted()).toEqual(["ubiquitous", "ubiquitous"])
    })

    it("reads again a paragraph that changed while a request for it failed", async () => {
      document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
      const refused = hold()
      const judge = judgeHard(["ubiquitous", "dog"])
      const host = createHost(async (blocks) => {
        if (host.judge.mock.calls.length !== 2) return judge(blocks)
        await refused.held
        return { ok: false, failure: { kind: "error" } }
      })
      const started = await startScanner(host)
      scanner = started.scanner
      started.observer.fire([$("#a")])
      await flush()
      onScreen($("#a"))
      scanner.refreshVisible([KNOWN])
      await settle()

      $("#a").replaceChildren("The ubiquitous dog.")
      await vi.advanceTimersByTimeAsync(100)
      refused.release()
      await vi.advanceTimersByTimeAsync(100)
      await flush()

      expect(host.judge).toHaveBeenCalledTimes(3)
      expect(host.judge.mock.calls[2]![0][0]!.text).toBe("The ubiquitous dog.")
      expect(painted()).toEqual(["ubiquitous", "dog"])
    })

    it("ends a wait for the connection once another request gets an answer", async () => {
      document.body.innerHTML = `<p id="a">${PARAGRAPH}</p><p id="b">${PARAGRAPH}</p>`
      const first = hold()
      const second = hold()
      const judge = judgeHard(["ubiquitous"])
      const host = createHost(async (blocks) => {
        const call = host.judge.mock.calls.length
        if (call === 1) {
          await first.held
          return { ok: false, failure: { kind: "offline" } }
        }
        if (call === 2) await second.held
        return judge(blocks)
      })
      const started = await startScanner(host)
      scanner = started.scanner
      started.observer.fire([$("#a")])
      await flush()
      started.observer.fire([$("#b")])
      await flush()
      expect(host.judge).toHaveBeenCalledTimes(2)

      first.release()
      await settle()
      second.release()
      await flush()

      expect(host.judge).toHaveBeenCalledTimes(3)
      expect(sentIds(host, 2)).toEqual(["b1"])
    })

    it("sends again, once it can, a changed paragraph whose new text did not go", async () => {
      document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
      const judge = judgeHard(["ubiquitous", "dog"])
      const host = createHost((blocks) =>
        host.judge.mock.calls.length === 2
          ? { ok: false, failure: { kind: "offline" } }
          : judge(blocks),
      )
      const started = await startScanner(host)
      scanner = started.scanner
      started.observer.fire([$("#a")])
      await flush()

      ;($("#a").firstChild as Text).data = "The ubiquitous dog."
      await vi.advanceTimersByTimeAsync(100)
      await flush()
      expect(host.judge).toHaveBeenCalledTimes(2)
      expect(painted()).toEqual([])

      await vi.advanceTimersByTimeAsync(2_000)
      expect(host.judge).toHaveBeenCalledTimes(3)
      expect(painted()).toEqual(["ubiquitous", "dog"])
    })

    it("waits a while, not at once, for a reset time already past by this clock", async () => {
      document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
      const past = () => new Date(Date.now() - 5_000).toISOString()
      const host = createHost(() =>
        host.judge.mock.calls.length === 1
          ? { ok: false, failure: { kind: "rateLimited", resetAt: past() } }
          : { ok: false, failure: { kind: "dailyLimit", resetAt: past() } },
      )
      const started = await startScanner(host)
      scanner = started.scanner
      started.observer.fire([$("#a")])
      await flush()

      await vi.advanceTimersByTimeAsync(9_999)
      expect(host.judge).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(host.judge).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(9_999)
      expect(host.judge).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(1)
      await settle()
      expect(host.judge).toHaveBeenCalledTimes(3)
    })

    it("waits out a rate limit until the time the server gives", async () => {
      document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
      let limited = true
      const judge = judgeHard(["ubiquitous"])
      const host = createHost((blocks) => {
        if (!limited) return judge(blocks)
        limited = false
        return {
          ok: false,
          failure: { kind: "rateLimited", resetAt: new Date(Date.now() + 30_000).toISOString() },
        }
      })
      const started = await startScanner(host)
      scanner = started.scanner
      started.observer.fire([$("#a")])
      await flush()

      await vi.advanceTimersByTimeAsync(29_000)
      expect(host.judge).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1_000)

      expect(host.judge).toHaveBeenCalledTimes(2)
      expect(painted()).toEqual(["ubiquitous", "ubiquitous"])
    })

    it("does not send again, until it changes, a paragraph the server refused", async () => {
      document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
      const host = createHost(failing({ kind: "error" }))
      const started = await startScanner(host)
      scanner = started.scanner
      started.observer.fire([$("#a")])
      await flush()

      started.observer.fire([$("#a")], false)
      started.observer.fire([$("#a")])
      await vi.advanceTimersByTimeAsync(60_000)
      expect(host.judge).toHaveBeenCalledTimes(1)

      ;($("#a").firstChild as Text).data = "Something else entirely now."
      await vi.advanceTimersByTimeAsync(100)
      await flush()
      expect(host.judge).toHaveBeenCalledTimes(2)
    })

    it("picks up again when the daily limit resets, unless closed by then", async () => {
      document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
      const host = createHost(() => ({
        ok: false,
        failure: { kind: "dailyLimit", resetAt: new Date(Date.now() + 60_000).toISOString() },
      }))
      const started = await startScanner(host)
      scanner = started.scanner
      started.observer.fire([$("#a")])
      await flush()

      await vi.advanceTimersByTimeAsync(59_000)
      expect(host.judge).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1_000)
      await settle()
      expect(host.judge).toHaveBeenCalledTimes(2)

      scanner.dispose()
      await vi.advanceTimersByTimeAsync(120_000)
      expect(host.judge).toHaveBeenCalledTimes(2)
    })
  })

  describe("the marked words the reader saw", () => {
    it("counts a word seen once it has been on screen for a second in all, and each lemma once a page", async () => {
      document.body.innerHTML = `<p id="a">${PARAGRAPH}</p><p id="b">Ubiquitous mats everywhere around.</p>`
      const host = createHost(judgeHard(["ubiquitous"]))
      const started = await startScanner(host)
      scanner = started.scanner
      started.observer.fire([$("#a"), $("#b")])
      await flush()

      onScreen($("#a"))
      await vi.advanceTimersByTimeAsync(500)
      offScreen($("#a"))
      await vi.advanceTimersByTimeAsync(5_000)
      expect(host.seen).not.toHaveBeenCalled()

      onScreen($("#a"))
      await vi.advanceTimersByTimeAsync(500)
      expect(host.seen).toHaveBeenCalledTimes(1)
      expect(host.seen).toHaveBeenCalledWith([{ lang: "en", v: 1, words: ["ubiquitous"] }])

      // The same lemma in another paragraph, and marking switched off and on again.
      onScreen($("#b"))
      await vi.advanceTimersByTimeAsync(5_000)
      scanner.dispose()
      const again = await startScanner(host)
      scanner = again.scanner
      again.observer.fire([$("#a"), $("#b")])
      await flush()
      await vi.advanceTimersByTimeAsync(5_000)
      expect(host.seen).toHaveBeenCalledTimes(1)
    })

    it("does not count the time the page is hidden", async () => {
      document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
      const host = createHost(judgeHard(["ubiquitous"]))
      const started = await startScanner(host)
      scanner = started.scanner
      started.observer.fire([$("#a")])
      await flush()
      onScreen($("#a"))
      const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")

      await vi.advanceTimersByTimeAsync(10_000)
      expect(host.seen).not.toHaveBeenCalled()

      visibility.mockReturnValue("visible")
      await vi.advanceTimersByTimeAsync(1_000)
      expect(host.seen).toHaveBeenCalledTimes(1)
    })

    it("sends the words seen together, as on the page, by language and the version that marked them", async () => {
      document.body.innerHTML =
        "<p id='a'>Ubiquitous cats sat on the mat.</p><p id='b'>Le chat omniprésent dort.</p>"
      const host = createHost((blocks) =>
        answer(
          blocks.map((block) =>
            block.text.startsWith("Le")
              ? { id: block.id, lang: "fr", v: 3, hard: findWords(block.text, ["omniprésent"]) }
              : {
                  id: block.id,
                  lang: "en",
                  v: 1,
                  hard: findWords(block.text, ["ubiquitous", "mat"]),
                },
          ),
        ),
      )
      const started = await startScanner(host)
      scanner = started.scanner
      started.observer.fire([$("#a"), $("#b")])
      await flush()
      onScreen($("#a"))
      onScreen($("#b"))

      await vi.advanceTimersByTimeAsync(1_000)

      expect(host.seen).toHaveBeenCalledTimes(1)
      expect(host.seen).toHaveBeenCalledWith([
        { lang: "en", v: 1, words: ["Ubiquitous", "mat"] },
        { lang: "fr", v: 3, words: ["omniprésent"] },
      ])
    })

    it("finds the marked word a selection is, and counts one opened or said known at once", async () => {
      document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
      const host = createHost(judgeHard(["ubiquitous"]))
      const started = await startScanner(host)
      scanner = started.scanner
      started.observer.fire([$("#a")])
      await flush()

      expect(scanner.markForSelection(rangeIn($("#a"), 15, 18), "cat")).toBeNull()
      const mark = scanner.markForSelection(rangeIn($("#a"), 30, 40), "ubiquitous")
      expect(mark).toMatchObject({ word: "ubiquitous", lemma: "ubiquitous", lang: "en", v: 1 })
      expect(mark!.range.startOffset).toBe(30)

      scanner.noteSeen(mark!)
      scanner.noteSeen(mark!)
      expect(host.seen).toHaveBeenCalledTimes(1)
      expect(host.seen).toHaveBeenCalledWith([{ lang: "en", v: 1, words: ["ubiquitous"] }])

      // Another page: counted again.
      history.replaceState(null, "", "/another-page")
      scanner.noteSeen(mark!)
      expect(host.seen).toHaveBeenCalledTimes(2)
    })
  })

  it("finds a mark again where a newer answer painted the same word, until it is unmarked", async () => {
    document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
    const host = createHost(judgeHard(["ubiquitous"]))
    const started = await startScanner(host)
    scanner = started.scanner
    started.observer.fire([$("#a")])
    await flush()
    const mark = scanner.markForSelection(rangeIn($("#a"), 30, 40), "ubiquitous")!
    expect(scanner.currentMark(mark)).toBe(mark)

    onScreen($("#a"))
    scanner.refreshVisible([KNOWN])
    await settle()

    expect(host.judge).toHaveBeenCalledTimes(2)
    expect(scanner.isMarked(mark)).toBe(false)
    const current = scanner.currentMark(mark)
    expect(current).not.toBe(mark)
    expect(current).toMatchObject({ word: "ubiquitous", lemma: "ubiquitous" })
    expect(current!.range.startOffset).toBe(30)

    scanner.hideLemma("en", "ubiquitous")
    expect(scanner.currentMark(mark)).toBeNull()
  })

  it("does not send a paragraph that went out of range before it was sent", async () => {
    document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
    const host = createHost(judgeHard(["ubiquitous"]))
    const started = await startScanner(host)
    scanner = started.scanner

    started.observer.fire([$("#a")])
    started.observer.fire([$("#a")], false)
    await flush()
    expect(host.judge).not.toHaveBeenCalled()

    started.observer.fire([$("#a")])
    await flush()
    expect(host.judge).toHaveBeenCalledTimes(1)
  })

  it("stops its first walk of the page when a new body is swapped in, and reads the new one", async () => {
    document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
    const run = vi.spyOn(BlockDiscovery.prototype, "run")
    const host = createHost(judgeHard(["ubiquitous"]))
    scanner = new DifficultWordsScanner(host)
    scanner.start()

    const next = document.createElement("body")
    next.innerHTML = `<p id="b">${PARAGRAPH}</p>`
    document.documentElement.replaceChild(next, document.body)
    await vi.advanceTimersByTimeAsync(100)

    expect(run).not.toHaveBeenCalled()
    expect(FakeIntersectionObserver.latest!.observed.has($("#b"))).toBe(true)
    expect(host.onEmpty).not.toHaveBeenCalled()
  })

  it("takes its marks and highlights away when disposed", async () => {
    document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
    const host = createHost(judgeHard(["ubiquitous"]))
    const started = await startScanner(host)
    scanner = started.scanner
    started.observer.fire([$("#a")])
    await flush()
    expect(registry.size).toBeGreaterThan(0)

    scanner.dispose()

    expect(registry.size).toBe(0)
    expect(started.observer.observed.size).toBe(0)
  })
})
