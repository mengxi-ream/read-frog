// @vitest-environment jsdom
import type { VocabEvent, VocabJudgeBlock, VocabJudgeOutput } from "@read-frog/api-contract"
import type { DifficultWordsScannerHost } from "../scanner"
import type { DifficultWordsJudgeResponse } from "../types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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
    onEmpty: vi.fn<DifficultWordsScannerHost["onEmpty"]>(),
  } satisfies DifficultWordsScannerHost
}

function answer(
  blocks: VocabJudgeOutput["blocks"],
  needsLevel: VocabJudgeOutput["needsLevel"] = [],
): DifficultWordsJudgeResponse {
  return { ok: true, output: { acked: [], blocks, needsLevel } }
}

/** Judges every block as English, marking the words of `hard` where they were sent. */
function judgeHard(hard: string[], v: number | (() => number) = 1): Judge {
  return (blocks) =>
    answer(
      blocks.map((block) => ({
        id: block.id,
        lang: "eng",
        v: typeof v === "function" ? v() : v,
        hard: (block.words ?? [])
          .filter((word) => hard.includes(word.toLowerCase()))
          .map((word) => ({ w: word, lemma: word.toLowerCase() })),
        learning: [],
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

let scanner: DifficultWordsScanner | null = null

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver)
  vi.stubGlobal("Highlight", FakeHighlight)
  vi.stubGlobal("CSS", { highlights: registry })
})

afterEach(() => {
  scanner?.dispose()
  scanner = null
  registry.clear()
  document.body.replaceChildren()
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
      { id: "b1", words: ["The", "ubiquitous", "cat", "sat", "on", "the", "mat"], starts: [0] },
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

  it("detects short neighbouring paragraphs together, the nearest first", async () => {
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

  it("sends Chinese and Japanese as text, and marks a word only where it really starts", async () => {
    const text = "我们讨论了量子纠缠的问题，量子纠缠很难。"
    document.body.innerHTML = `<p id="a" lang="zh-CN">${text}</p>`
    const host = createHost((blocks) =>
      answer([
        {
          id: blocks[0]!.id,
          lang: "cmn",
          v: 1,
          hard: [{ w: "量子纠缠", lemma: "量子纠缠", at: [5, 2, 13, 40] }],
          learning: [],
        },
      ]),
    )
    const started = await startScanner(host)
    scanner = started.scanner

    started.observer.fire([$("#a")])
    await flush()

    expect(host.judge.mock.calls[0]![0]).toEqual([{ id: "b1", text, hint: "zh-CN" }])
    expect(painted()).toEqual(["量子纠缠", "量子纠缠"])
    expect(scanner.languageAt($("#a").firstChild!)).toBe("cmn")
  })

  it("unmarks a word the reader knows in every paragraph, and marks it again on undo", async () => {
    document.body.innerHTML = `<p id="a">${PARAGRAPH}</p><p id="b">Ubiquitous mats everywhere around.</p>`
    const host = createHost(judgeHard(["ubiquitous"]))
    const started = await startScanner(host)
    scanner = started.scanner
    started.observer.fire([$("#a"), $("#b")])
    await flush()
    expect(painted()).toHaveLength(3)

    scanner.hideLemma("eng", "ubiquitous")

    expect(painted()).toEqual([])
    expect(scanner.count).toBe(0)

    scanner.showLemma("eng", "ubiquitous")

    expect(painted()).toHaveLength(3)
  })

  it("keeps a known word unmarked when its paragraph is judged again", async () => {
    document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
    const host = createHost(judgeHard(["ubiquitous", "cat"]))
    const started = await startScanner(host)
    scanner = started.scanner
    started.observer.fire([$("#a")])
    await flush()
    scanner.hideLemma("eng", "ubiquitous")

    $("#a").firstChild!.textContent = "A ubiquitous cat again."
    await vi.advanceTimersByTimeAsync(100)
    await flush()

    expect(host.judge).toHaveBeenCalledTimes(2)
    expect(painted()).toEqual(["cat"])
  })

  it("sends a paragraph again when its words change, and repaints it without asking when only its nodes do", async () => {
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
      { id: "b1", words: ["The", "ubiquitous", "dog"], starts: [0], group: expect.any(String) },
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
    expect(host.judge.mock.calls[1]![0][0]!.words).toEqual(["The", "ubiquitous", "dog"])
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
      lang: "eng",
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

  it("asks for a level, and judges the paragraphs waiting for it once it is given", async () => {
    document.body.innerHTML = `<p id="a">${PARAGRAPH}</p>`
    let hasLevel = false
    const judge = judgeHard(["ubiquitous"])
    const host = createHost((blocks) =>
      hasLevel
        ? judge(blocks)
        : answer([{ id: blocks[0]!.id, lang: "eng", skip: "level" }], ["eng"]),
    )
    const started = await startScanner(host)
    scanner = started.scanner
    started.observer.fire([$("#a")])
    await flush()
    expect(host.onNeedsLevel).toHaveBeenCalledWith(["eng"])
    expect(painted()).toEqual([])

    hasLevel = true
    scanner.retryLevel("eng")
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
