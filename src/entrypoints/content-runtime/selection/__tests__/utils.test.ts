// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildContextSnapshot,
  createRangeSnapshot,
  readRangeClientRects,
  readSelectionSnapshot,
  toLiveRange,
} from "../utils"
import { createShadowSelection } from "./composed-selection"

interface ShadowTree {
  html: string
  // Hosts inside `html`, by selector, and the shadow trees they hold.
  shadows?: Record<string, ShadowTree>
}

function attachShadowTrees(scope: ParentNode, shadows: Record<string, ShadowTree>) {
  for (const [selector, tree] of Object.entries(shadows)) {
    const host = scope.querySelector(selector)
    if (!host) {
      throw new Error(`Shadow host ${selector} not found`)
    }

    const shadowRoot = host.attachShadow({ mode: "open" })
    shadowRoot.innerHTML = tree.html
    attachShadowTrees(shadowRoot, tree.shadows ?? {})
  }
}

// The shadow root reached by following each host selector down from the document.
function getShadowRoot(...hostSelectors: string[]) {
  let scope: Document | ShadowRoot = document
  for (const selector of hostSelectors) {
    const shadowRoot: ShadowRoot | null | undefined = scope.querySelector(selector)?.shadowRoot
    if (!shadowRoot) {
      throw new Error(`No open shadow root at ${selector}`)
    }
    scope = shadowRoot
  }
  return scope
}

const BILIBILI_COMMENT = ["bili-comments", "bili-comment-thread-renderer", "bili-comment-renderer"]
const BILIBILI_REPLY = [
  "bili-comments",
  "bili-comment-thread-renderer",
  "bili-comment-replies-renderer",
  "bili-comment-reply-renderer",
]

// Bilibili's comment section, cut down: each part renders in its own open
// shadow root, and a reply sits five shadow roots deep.
function renderBilibiliComments() {
  const body = `<div id="body"><div id="main"><bili-comment-user-info><a href="#"><img alt=""></a></bili-comment-user-info> <bili-rich-text></bili-rich-text></div><div id="footer"><bili-comment-action-buttons-renderer></bili-comment-action-buttons-renderer></div></div>`
  const parts = (userName: string, text: string, pubdate: string) => ({
    "bili-comment-user-info": {
      html: `<div id="info"><slot></slot><div id="user-name">${userName}</div></div>`,
    },
    "bili-rich-text": { html: `<p id="contents"><span>${text}</span></p>` },
    "bili-comment-action-buttons-renderer": {
      html: `<div id="pubdate">${pubdate}</div><div id="like"><button>23</button></div>`,
    },
  })

  document.body.innerHTML = `<div id="commentapp"><bili-comments></bili-comments></div>`
  attachShadowTrees(document, {
    "bili-comments": {
      html: `<div id="feed"><bili-comment-thread-renderer></bili-comment-thread-renderer></div>`,
      shadows: {
        "bili-comment-thread-renderer": {
          html: `<bili-comment-renderer></bili-comment-renderer><div id="replies"><bili-comment-replies-renderer></bili-comment-replies-renderer></div>`,
          shadows: {
            "bili-comment-renderer": {
              html: body,
              shadows: parts("Kids", "Kids, don't be afraid.", "8 hours ago"),
            },
            "bili-comment-replies-renderer": {
              html: `<bili-comment-reply-renderer></bili-comment-reply-renderer>`,
              shadows: {
                "bili-comment-reply-renderer": {
                  html: body,
                  shadows: parts("小猫蛋卷OvO", "I'm scared", "5 hours ago"),
                },
              },
            },
          },
        },
      },
    },
  })
}

function getRichTextNode(...hostSelectors: string[]) {
  const node = getShadowRoot(...hostSelectors, "bili-rich-text").querySelector("span")?.firstChild
  if (!(node instanceof Text)) {
    throw new Error("Rich text not found")
  }
  return node
}

function createSelectionSnapshot(range: Range, text = range.toString()) {
  return {
    text,
    ranges: [
      createRangeSnapshot({
        startContainer: range.startContainer,
        startOffset: range.startOffset,
        endContainer: range.endContainer,
        endOffset: range.endOffset,
      }),
    ],
  }
}

// Chrome reports a selection inside an <input>/<textarea> as a range around the
// control element itself; the selected text is only reachable via toString().
function createTextControlSelection(
  control: HTMLInputElement | HTMLTextAreaElement,
  text: string,
): Selection {
  const parent = control.parentNode
  if (!parent) {
    throw new Error("Text control is detached")
  }

  const index = Array.prototype.indexOf.call(parent.childNodes, control)
  const range = document.createRange()
  range.setStart(parent, index)
  range.setEnd(parent, index + 1)

  return {
    toString: () => text,
    anchorNode: parent,
    focusNode: parent,
    rangeCount: 1,
    getRangeAt: () => range,
    getComposedRanges: () => [range],
  } as unknown as Selection
}

const DEMO_HEAD_HTML = `
  <title>Shortcut demo</title>
  <style>body{font:20px/1.6 system-ui;margin:70px auto;max-width:760px;color:#1f2328}</style>
`

afterEach(() => {
  document.head.innerHTML = ""
  document.body.innerHTML = ""
})

describe("buildContextSnapshot", () => {
  it("returns the nearest paragraph-like element text for selections spanning inline DOM nodes", () => {
    document.body.innerHTML = `
      <article>
        <p id="paragraph">
          Alpha text
          <strong id="selection-start">Beta</strong>
          gamma
          <em id="selection-end">delta</em>
          text
        </p>
      </article>
    `

    const startNode = document.getElementById("selection-start")?.firstChild
    const endNode = document.getElementById("selection-end")?.firstChild
    if (!startNode || !endNode) {
      throw new Error("Selection nodes not found")
    }

    const range = document.createRange()
    range.setStart(startNode, 0)
    range.setEnd(endNode, endNode.textContent?.length ?? 0)

    expect(buildContextSnapshot(createSelectionSnapshot(range))).toEqual({
      text: "Alpha text Beta gamma delta text",
      paragraphs: ["Alpha text Beta gamma delta text"],
    })
  })

  it("joins intersected paragraphs in document order when the selection crosses multiple paragraphs", () => {
    document.body.innerHTML = `
      <article>
        <p id="first">Alpha <strong id="start">Beta</strong> gamma.</p>
        <p id="second">Delta <em id="end">epsilon</em> zeta.</p>
      </article>
    `

    const startNode = document.getElementById("start")?.firstChild
    const endNode = document.getElementById("end")?.firstChild
    if (!startNode || !endNode) {
      throw new Error("Selection nodes not found")
    }

    const range = document.createRange()
    range.setStart(startNode, 0)
    range.setEnd(endNode, endNode.textContent?.length ?? 0)

    expect(buildContextSnapshot(createSelectionSnapshot(range))).toEqual({
      text: "Alpha Beta gamma.\n\nDelta epsilon zeta.",
      paragraphs: ["Alpha Beta gamma.", "Delta epsilon zeta."],
    })
  })

  it("uses generic block ancestors before falling back to broad semantic containers", () => {
    document.body.innerHTML = `
      <article id="article">
        <div id="block">
          Alpha
          <span id="selection">Beta</span>
          gamma
        </div>
      </article>
    `

    const selectionNode = document.getElementById("selection")?.firstChild
    if (!selectionNode) {
      throw new Error("Selection node not found")
    }

    const range = document.createRange()
    range.setStart(selectionNode, 0)
    range.setEnd(selectionNode, selectionNode.textContent?.length ?? 0)

    expect(buildContextSnapshot(createSelectionSnapshot(range))).toEqual({
      text: "Alpha Beta gamma",
      paragraphs: ["Alpha Beta gamma"],
    })
  })

  it("falls back to semantic containers only when no smaller paragraph-like block exists", () => {
    document.body.innerHTML = `
      <article id="article">
        Alpha
        <span id="selection">Beta</span>
        gamma
      </article>
    `

    const selectionNode = document.getElementById("selection")?.firstChild
    if (!selectionNode) {
      throw new Error("Selection node not found")
    }

    const range = document.createRange()
    range.setStart(selectionNode, 0)
    range.setEnd(selectionNode, selectionNode.textContent?.length ?? 0)

    expect(buildContextSnapshot(createSelectionSnapshot(range))).toEqual({
      text: "Alpha Beta gamma",
      paragraphs: ["Alpha Beta gamma"],
    })
  })

  it("never collects head, style or script text when no block ancestor sits below body", () => {
    document.head.innerHTML = DEMO_HEAD_HTML
    document.body.innerHTML = `
      <span id="selection">Alpha beta</span>
      <style>.inline { color: red; }</style>
      <script>window.readFrogFixture = true</script>
      <noscript>Enable JavaScript</noscript>
    `

    const selectionNode = document.getElementById("selection")?.firstChild
    if (!selectionNode) {
      throw new Error("Selection node not found")
    }

    const range = document.createRange()
    range.setStart(selectionNode, 0)
    range.setEnd(selectionNode, selectionNode.textContent?.length ?? 0)

    expect(buildContextSnapshot(createSelectionSnapshot(range))).toEqual({
      text: "Alpha beta",
      paragraphs: ["Alpha beta"],
    })
  })
})

describe("text control selections", () => {
  it("uses the focused textarea's current value instead of the page's head text", () => {
    document.head.innerHTML = DEMO_HEAD_HTML
    document.body.innerHTML = `
      <h1>Demo</h1>
      <p>First paragraph on the page.</p>
      <p>Second paragraph on the page.</p>
      <textarea id="field">Default textarea text</textarea>
    `

    const textarea = document.getElementById("field")
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error("Textarea not found")
    }

    textarea.value = "I has wrote this sentence badly."
    textarea.focus()
    textarea.setSelectionRange(0, textarea.value.length)

    const snapshot = readSelectionSnapshot(
      createTextControlSelection(textarea, "I has wrote this sentence badly."),
    )

    expect(snapshot?.textControl).toEqual({
      value: "I has wrote this sentence badly.",
      selectionStart: 0,
      selectionEnd: 32,
    })
    expect(buildContextSnapshot(snapshot)).toEqual({
      text: "I has wrote this sentence badly.",
      paragraphs: ["I has wrote this sentence badly."],
    })
  })

  it("keeps only the blank-line separated textarea paragraphs that overlap the selection", () => {
    document.body.innerHTML = `<div><textarea id="field"></textarea></div>`

    const textarea = document.getElementById("field")
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error("Textarea not found")
    }

    textarea.value = [
      "Opening paragraph,\nwrapped onto a second line.",
      "Middle paragraph with the target words.",
      "Closing paragraph.",
    ].join("\n\n  \n")
    textarea.focus()

    const middleStart = textarea.value.indexOf("target words")
    textarea.setSelectionRange(middleStart, middleStart + "target words".length)
    expect(
      buildContextSnapshot(
        readSelectionSnapshot(createTextControlSelection(textarea, "target words")),
      ),
    ).toEqual({
      text: "Middle paragraph with the target words.",
      paragraphs: ["Middle paragraph with the target words."],
    })

    const spanStart = textarea.value.indexOf("second line")
    textarea.setSelectionRange(spanStart, middleStart)
    expect(
      buildContextSnapshot(
        readSelectionSnapshot(
          createTextControlSelection(textarea, textarea.value.slice(spanStart, middleStart)),
        ),
      )?.paragraphs,
    ).toEqual([
      "Opening paragraph, wrapped onto a second line.",
      "Middle paragraph with the target words.",
    ])
  })

  it("uses the value of a focused text input", () => {
    document.body.innerHTML = `
      <p>
        <label for="field">Search the docs</label>
        <input id="field" type="search" value="selection toolbar shortcuts">
      </p>
    `

    const input = document.getElementById("field")
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Input not found")
    }

    input.focus()
    input.setSelectionRange(10, 17)

    expect(
      buildContextSnapshot(readSelectionSnapshot(createTextControlSelection(input, "toolbar"))),
    ).toEqual({
      text: "selection toolbar shortcuts",
      paragraphs: ["selection toolbar shortcuts"],
    })
  })

  it("never reads the value of a password field", () => {
    document.body.innerHTML = `
      <p>
        <label for="field">Password</label>
        <input id="field" type="password" value="hunter2secret">
      </p>
    `

    const input = document.getElementById("field")
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Input not found")
    }

    input.focus()
    input.setSelectionRange(0, 6)

    const snapshot = readSelectionSnapshot(createTextControlSelection(input, "••••••"))

    expect(snapshot?.textControl).toBeUndefined()
    expect(JSON.stringify(buildContextSnapshot(snapshot))).not.toContain("hunter2")
  })

  it("ignores focused controls that do not hold the selection", () => {
    document.body.innerHTML = `
      <p id="paragraph">Alpha <span id="selection">Beta</span> gamma</p>
      <input id="checkbox" type="checkbox">
      <textarea id="field">Caret only</textarea>
    `

    const selectionNode = document.getElementById("selection")?.firstChild
    const checkbox = document.getElementById("checkbox")
    const textarea = document.getElementById("field")
    if (
      !selectionNode ||
      !(checkbox instanceof HTMLInputElement) ||
      !(textarea instanceof HTMLTextAreaElement)
    ) {
      throw new Error("Fixtures not found")
    }

    const range = document.createRange()
    range.setStart(selectionNode, 0)
    range.setEnd(selectionNode, selectionNode.textContent?.length ?? 0)
    const selection = {
      toString: () => "Beta",
      rangeCount: 1,
      getRangeAt: () => range,
    } as unknown as Selection

    checkbox.focus()
    expect(readSelectionSnapshot(selection)?.textControl).toBeUndefined()

    textarea.focus()
    textarea.setSelectionRange(3, 3)
    const snapshot = readSelectionSnapshot(selection)
    expect(snapshot?.textControl).toBeUndefined()
    expect(buildContextSnapshot(snapshot)?.paragraphs).toEqual(["Alpha Beta gamma"])
  })
})

describe("readSelectionSnapshot", () => {
  it("returns the selected text and captured ranges", () => {
    document.body.innerHTML = `
      <div id="editable" contenteditable="true">
        Alpha <span id="selection">Beta</span> gamma
      </div>
    `

    const selectionNode = document.getElementById("selection")?.firstChild
    if (!selectionNode) {
      throw new Error("Selection node not found")
    }

    const range = document.createRange()
    range.setStart(selectionNode, 0)
    range.setEnd(selectionNode, selectionNode.textContent?.length ?? 0)

    const selection = {
      toString: () => "Beta",
      rangeCount: 1,
      getRangeAt: () => range,
    } as unknown as Selection

    expect(readSelectionSnapshot(selection)).toMatchObject({
      text: "Beta",
      ranges: [
        expect.objectContaining({
          startContainer: selectionNode,
          startOffset: 0,
          endContainer: selectionNode,
          endOffset: 4,
        }),
      ],
    })
  })

  it("does not include unrelated shadow roots for light DOM selections", () => {
    document.body.innerHTML = `<div id="selection">Beta</div>`

    const unrelatedHost = document.createElement("div")
    unrelatedHost.attachShadow({ mode: "open" })
    document.body.appendChild(unrelatedHost)

    const selectionNode = document.getElementById("selection")?.firstChild
    if (!selectionNode) {
      throw new Error("Selection node not found")
    }

    const range = document.createRange()
    range.setStart(selectionNode, 0)
    range.setEnd(selectionNode, selectionNode.textContent?.length ?? 0)

    const getComposedRanges = vi.fn<(...args: any[]) => any>(() => [range])
    const selection = {
      toString: () => "Beta",
      anchorNode: selectionNode,
      focusNode: selectionNode,
      rangeCount: 1,
      getRangeAt: () => range,
      getComposedRanges,
    } as unknown as Selection

    readSelectionSnapshot(selection)

    expect(getComposedRanges).toHaveBeenCalledWith({
      shadowRoots: [],
    })
  })

  it("hands getComposedRanges() the shadow roots a selection is in, one level at a time", () => {
    document.body.innerHTML = `<div id="outer"></div><div id="unrelated"></div>`
    attachShadowTrees(document, {
      "#outer": { html: `<div id="inner"></div>`, shadows: { "#inner": { html: `<p>Beta</p>` } } },
      "#unrelated": { html: `<p>Gamma</p>` },
    })

    const outerShadowRoot = getShadowRoot("#outer")
    const innerShadowRoot = getShadowRoot("#outer", "#inner")
    const selectedText = innerShadowRoot.querySelector("p")?.firstChild
    if (!selectedText) {
      throw new Error("Selection node not found")
    }

    const { selection, getComposedRanges } = createShadowSelection(
      { startContainer: selectedText, startOffset: 0, endContainer: selectedText, endOffset: 4 },
      "Beta",
    )

    expect(readSelectionSnapshot(selection)).toEqual({
      text: "Beta",
      ranges: [
        { startContainer: selectedText, startOffset: 0, endContainer: selectedText, endOffset: 4 },
      ],
    })
    expect(getComposedRanges.mock.calls).toEqual([
      [{ shadowRoots: [] }],
      [{ shadowRoots: [outerShadowRoot] }],
      [{ shadowRoots: [outerShadowRoot, innerShadowRoot] }],
    ])
  })

  // https://github.com/mengxi-ream/read-frog/pull/1771
  it("finds the shadow root of Read Frog's own subtitles", () => {
    const subtitle =
      "fears that anti-immigration protests could descend into widespread violence against foreigners."
    document.body.innerHTML = `<div id="read-frog-subtitles-ui-host"></div>`
    attachShadowTrees(document, {
      "#read-frog-subtitles-ui-host": { html: `<div class="subtitles-main">${subtitle}</div>` },
    })

    const subtitlesShadowRoot = getShadowRoot("#read-frog-subtitles-ui-host")
    const subtitleNode = subtitlesShadowRoot.querySelector(".subtitles-main")?.firstChild
    if (!subtitleNode) {
      throw new Error("Subtitle text node not found")
    }

    const wordStart = subtitle.indexOf("against")
    const { selection, getComposedRanges } = createShadowSelection(
      {
        startContainer: subtitleNode,
        startOffset: wordStart,
        endContainer: subtitleNode,
        endOffset: wordStart + "against".length,
      },
      "against",
    )

    const snapshot = readSelectionSnapshot(selection)

    expect(getComposedRanges.mock.calls).toEqual([
      [{ shadowRoots: [] }],
      [{ shadowRoots: [subtitlesShadowRoot] }],
    ])
    expect(snapshot).toEqual({
      text: "against",
      ranges: [
        {
          startContainer: subtitleNode,
          startOffset: wordStart,
          endContainer: subtitleNode,
          endOffset: wordStart + "against".length,
        },
      ],
    })
    expect(buildContextSnapshot(snapshot)).toEqual({ text: subtitle, paragraphs: [subtitle] })
  })

  it("falls back to getRangeAt when getComposedRanges returns no ranges", () => {
    document.body.innerHTML = `<div id="selection">Beta</div>`

    const selectionNode = document.getElementById("selection")?.firstChild
    if (!selectionNode) {
      throw new Error("Selection node not found")
    }

    const range = document.createRange()
    range.setStart(selectionNode, 0)
    range.setEnd(selectionNode, selectionNode.textContent?.length ?? 0)

    const getRangeAt = vi.fn<(...args: any[]) => any>(() => range)
    const getComposedRanges = vi.fn<(...args: any[]) => any>(() => [])
    const selection = {
      toString: () => "Beta",
      anchorNode: selectionNode,
      focusNode: selectionNode,
      rangeCount: 1,
      getRangeAt,
      getComposedRanges,
    } as unknown as Selection

    expect(readSelectionSnapshot(selection)).toMatchObject({
      text: "Beta",
      ranges: [
        expect.objectContaining({
          startContainer: selectionNode,
          startOffset: 0,
          endContainer: selectionNode,
          endOffset: 4,
        }),
      ],
    })
    expect(getRangeAt).toHaveBeenCalledWith(0)
  })

  // https://github.com/mengxi-ream/read-frog/issues/2385
  it("reads a triple-clicked Bilibili reply, which the browser's own text leaves blank", () => {
    renderBilibiliComments()

    // A triple click starts at the space after the user info and ends at the
    // start of the date, in the action buttons' shadow root.
    const start = getShadowRoot(...BILIBILI_REPLY).querySelector(
      "bili-comment-user-info",
    )?.nextSibling
    const pubdate = getShadowRoot(
      ...BILIBILI_REPLY,
      "bili-comment-action-buttons-renderer",
    ).querySelector("#pubdate")
    if (!start || !pubdate) {
      throw new Error("Selection boundaries not found")
    }

    const { selection, getComposedRanges } = createShadowSelection(
      { startContainer: start, startOffset: 0, endContainer: pubdate, endOffset: 0 },
      " \n",
    )
    const snapshot = readSelectionSnapshot(selection)

    expect(snapshot).toEqual({
      text: "I'm scared",
      ranges: [{ startContainer: start, startOffset: 0, endContainer: pubdate, endOffset: 0 }],
    })
    // One call per shadow root on the way down, then one to see nothing moves.
    expect(getComposedRanges).toHaveBeenCalledTimes(6)
    expect(buildContextSnapshot(snapshot)?.paragraphs).toEqual(["I'm scared"])
  })

  it("reads a selection dragged from a Bilibili comment into its reply", () => {
    renderBilibiliComments()

    const commentText = getRichTextNode(...BILIBILI_COMMENT)
    const replyText = getRichTextNode(...BILIBILI_REPLY)
    const { selection } = createShadowSelection(
      {
        startContainer: commentText,
        startOffset: 0,
        endContainer: replyText,
        endOffset: replyText.length,
      },
      "Kids, don't be afraid.",
    )
    const snapshot = readSelectionSnapshot(selection)

    expect(snapshot?.text).toBe(
      "Kids, don't be afraid.\n\n8 hours ago\n23\n小猫蛋卷OvO\nI'm scared",
    )
    expect(buildContextSnapshot(snapshot)?.paragraphs).toEqual([
      "Kids, don't be afraid.",
      "8 hours ago",
      "23",
      "小猫蛋卷OvO",
      "I'm scared",
    ])
  })

  it("reads the text a page selection covers inside a shadow root, in the same paragraph", () => {
    document.body.innerHTML = `<p id="commit">Latest commit <relative-time datetime="2026-11-10">Nov 10, 2026</relative-time> · History</p>`
    const relativeTime = document.querySelector("relative-time")
    const paragraph = document.getElementById("commit")
    if (!relativeTime || !paragraph) {
      throw new Error("Fixtures not found")
    }
    // Rendered in place of the light DOM date, straight under the shadow root.
    relativeTime.attachShadow({ mode: "open" }).textContent = "5 days ago"

    const range = document.createRange()
    range.selectNodeContents(paragraph)
    const selection = {
      type: "Range",
      toString: () => "Latest commit · History",
      rangeCount: 1,
      getRangeAt: () => range,
      getComposedRanges: () => [range],
    } as unknown as Selection
    const snapshot = readSelectionSnapshot(selection)

    expect(snapshot?.text).toBe("Latest commit 5 days ago · History")
    expect(buildContextSnapshot(snapshot)?.paragraphs).toEqual([
      "Latest commit 5 days ago · History",
    ])
  })

  it("reads whitespace the way the page renders it", () => {
    document.body.innerHTML = `
      <p><span id="normal">勉強  する
        つもり</span></p>
      <p><span id="pre-wrap" style="white-space: pre-wrap">勉強  する</span></p>
      <article><p id="first">Alpha</p>
        <p id="second">Beta<br>Gamma</p><div id="third">Delta</div></article>
    `

    const readText = (range: Range) =>
      readSelectionSnapshot({
        toString: () => range.toString(),
        rangeCount: 1,
        getRangeAt: () => range,
        getComposedRanges: () => [range],
      } as unknown as Selection)?.text

    const range = document.createRange()
    range.selectNodeContents(document.getElementById("normal")!)
    expect(readText(range)).toBe("勉強 する つもり")

    range.selectNodeContents(document.getElementById("pre-wrap")!)
    expect(readText(range)).toBe("勉強  する")

    range.setStart(document.getElementById("first")!, 0)
    range.setEnd(document.getElementById("third")!, 1)
    expect(readText(range)).toBe("Alpha\n\nBeta\nGamma\n\nDelta")
  })
})

describe("toLiveRange", () => {
  it("refuses a range whose boundaries are in different trees", () => {
    document.body.innerHTML = `<p id="light">Alpha</p><div id="host"></div>`
    attachShadowTrees(document, { "#host": { html: `<p>Beta</p>` } })
    const lightText = document.getElementById("light")?.firstChild
    const shadowText = getShadowRoot("#host").querySelector("p")?.firstChild
    if (!lightText || !shadowText) {
      throw new Error("Fixtures not found")
    }

    expect(
      toLiveRange({
        startContainer: lightText,
        startOffset: 1,
        endContainer: lightText,
        endOffset: 4,
      }).toString(),
    ).toBe("lph")
    // Range.setEnd() would collapse it to the end instead.
    expect(() =>
      toLiveRange({
        startContainer: lightText,
        startOffset: 0,
        endContainer: shadowText,
        endOffset: 4,
      }),
    ).toThrow("A live Range can't span shadow roots")
  })
})

describe("readRangeClientRects", () => {
  // jsdom has no layout, so Range.getClientRects() is stood in for.
  const originalGetClientRects = Object.getOwnPropertyDescriptor(Range.prototype, "getClientRects")

  afterEach(() => {
    if (originalGetClientRects) {
      Object.defineProperty(Range.prototype, "getClientRects", originalGetClientRects)
    } else {
      Reflect.deleteProperty(Range.prototype, "getClientRects")
    }
  })

  it("measures a range across shadow roots by the text it covers", () => {
    document.body.innerHTML = `<p id="light">Alpha</p><div id="host"></div>`
    attachShadowTrees(document, { "#host": { html: `<p>Beta<br>Gamma</p>` } })
    const lightText = document.getElementById("light")?.firstChild
    const lastText = getShadowRoot("#host").querySelector("p")?.lastChild
    if (!lightText || !lastText) {
      throw new Error("Fixtures not found")
    }

    const measured: string[] = []
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value(this: Range) {
        const node = this.startContainer.childNodes[this.startOffset]
        measured.push(node instanceof HTMLBRElement ? "<br>" : this.toString())
        return [{ width: 10, height: 10 }]
      },
    })

    const rects = readRangeClientRects({
      startContainer: lightText,
      startOffset: 2,
      endContainer: lastText,
      endOffset: 2,
    })

    expect(measured).toEqual(["pha", "Beta", "<br>", "Ga"])
    expect(rects).toHaveLength(4)
  })
})

// https://github.com/mengxi-ream/read-frog/issues/2371
describe("ruby annotations", () => {
  // Like the browser's selection text, Range.toString() keeps the furigana. A
  // browser without getComposedRanges() is left with that text.
  function createRangeSelection(range: Range): Selection {
    return {
      toString: () => range.toString(),
      anchorNode: range.startContainer,
      focusNode: range.endContainer,
      rangeCount: 1,
      getRangeAt: () => range,
      getComposedRanges: () => [range],
    } as unknown as Selection
  }

  function getTextNode(id: string) {
    const node = document.getElementById(id)?.firstChild
    if (!(node instanceof Text)) {
      throw new Error(`Text node #${id} not found`)
    }
    return node
  }

  it("leaves furigana and its fallback parentheses out of the selected text", () => {
    document.body.innerHTML = `<p id="paragraph"><ruby>漢字<rt>かんじ</rt></ruby>を<ruby>勉強<rp>(</rp><rt>べんきょう</rt><rp>)</rp></ruby>する</p>`

    const range = document.createRange()
    range.selectNodeContents(document.getElementById("paragraph")!)
    expect(range.toString()).toBe("漢字かんじを勉強(べんきょう)する")

    expect(readSelectionSnapshot(createRangeSelection(range))?.text).toBe("漢字を勉強する")
  })

  it("keeps only the selected part of the base text", () => {
    document.body.innerHTML = `<p><ruby id="start">東京<rt>とうきょう</rt></ruby>で<ruby>雪<rt>ゆき</rt></ruby><span id="end">が降りました</span></p>`

    const range = document.createRange()
    range.setStart(getTextNode("start"), 1)
    range.setEnd(getTextNode("end"), 2)

    expect(readSelectionSnapshot(createRangeSelection(range))?.text).toBe("京で雪が降")
  })

  it("starts each selected paragraph on a new line and collapses whitespace", () => {
    document.body.innerHTML = `
      <article>
        <p id="first"><ruby>今日<rt>きょう</rt></ruby>は
          <ruby>雪<rt>ゆき</rt></ruby>です。</p>
        <p id="second"><ruby>電車<rt>でんしゃ</rt></ruby>が<ruby>遅<rt>おく</rt></ruby>れます。</p>
      </article>
    `

    const range = document.createRange()
    range.setStart(document.getElementById("first")!, 0)
    range.setEnd(document.getElementById("second")!, 4)

    expect(readSelectionSnapshot(createRangeSelection(range))?.text).toBe(
      "今日は 雪です。\n\n電車が遅れます。",
    )
  })

  it("keeps line breaks from <br> and from white-space that preserves them", () => {
    document.body.innerHTML = `
      <p id="br"><ruby>雪<rt>ゆき</rt></ruby>が降る<br><ruby>風<rt>かぜ</rt></ruby>が吹く</p>
      <div id="pre-line" style="white-space: pre-line"><ruby>春<rt>はる</rt></ruby>の海
<ruby>夏<rt>なつ</rt></ruby>の山</div>
    `

    const brRange = document.createRange()
    brRange.selectNodeContents(document.getElementById("br")!)
    expect(readSelectionSnapshot(createRangeSelection(brRange))?.text).toBe("雪が降る\n風が吹く")

    const preLineRange = document.createRange()
    preLineRange.selectNodeContents(document.getElementById("pre-line")!)
    expect(readSelectionSnapshot(createRangeSelection(preLineRange))?.text).toBe("春の海\n夏の山")
  })

  it("leaves hidden text out, as the browser does", () => {
    document.body.innerHTML = `<p id="paragraph"><ruby>漢字<rt>かんじ</rt></ruby><span style="display: none">hidden</span>です</p>`

    const range = document.createRange()
    range.selectNodeContents(document.getElementById("paragraph")!)

    expect(readSelectionSnapshot(createRangeSelection(range))?.text).toBe("漢字です")
  })

  it("keeps the furigana when nothing else is selected", () => {
    document.body.innerHTML = `<p><ruby>漢字<rt id="reading">かんじ</rt></ruby>です</p>`

    const range = document.createRange()
    range.selectNodeContents(getTextNode("reading"))

    expect(readSelectionSnapshot(createRangeSelection(range))?.text).toBe("かんじ")
  })

  it("leaves furigana out of the paragraph context", () => {
    document.body.innerHTML = `<p id="paragraph"><ruby>漢字<rt>かんじ</rt></ruby>を<ruby id="selected">勉強<rp>(</rp><rt>べんきょう</rt><rp>)</rp></ruby>する</p>`

    const range = document.createRange()
    range.selectNodeContents(getTextNode("selected"))

    expect(buildContextSnapshot(createSelectionSnapshot(range))).toEqual({
      text: "漢字を勉強する",
      paragraphs: ["漢字を勉強する"],
    })
  })
})
