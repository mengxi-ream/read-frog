// @vitest-environment jsdom
import type { SelectionRangeSnapshot } from "../utils"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { ANNOTATION_HOST_ATTRIBUTE } from "@/utils/annotate/styles"
import { REACT_SHADOW_HOST_CLASS } from "@/utils/constants/dom-labels"
import { PROTECTED_HOST_ATTRIBUTE } from "@/utils/select-all"
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

// A selection whose ends are in one tree, as a browser with getComposedRanges()
// reports it.
function createTreeSelection(range: SelectionRangeSnapshot, browserText: string) {
  return {
    toString: () => browserText,
    anchorNode: range.startContainer,
    focusNode: range.endContainer,
    rangeCount: 1,
    getRangeAt: () => range,
    getComposedRanges: () => [range],
  } as unknown as Selection
}

// Selected from the start of `selector`, inside a shadow root, to the end of the
// page. The ends are in different trees, where the browser's text misses most
// of the selection, so the text is read from the page.
function readTextFromShadowRoot(html: string, selector: string) {
  document.body.innerHTML = `<div id="host"></div>`
  const shadowRoot = document.getElementById("host")!.attachShadow({ mode: "open" })
  shadowRoot.innerHTML = html
  const start = shadowRoot.querySelector(selector)
  if (!start) {
    throw new Error(`Selection start ${selector} not found`)
  }

  const { selection } = createShadowSelection(
    {
      startContainer: start,
      startOffset: 0,
      endContainer: document.body,
      endOffset: document.body.childNodes.length,
    },
    "",
  )
  return readSelectionSnapshot(selection)?.text
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
  it("leaves Read Frog's own overlays out when the context falls back to body", () => {
    document.body.innerHTML = `
      <span id="selection">Alpha beta</span>
      <div class="notranslate read-frog-react-shadow-host" id="panel"></div>
      <div class="notranslate" ${ANNOTATION_HOST_ATTRIBUTE} id="layer"></div>
    `
    attachShadowTrees(document, {
      "#panel": { html: "<p>Page diagnosis 3 paragraphs</p>" },
      "#layer": { html: "<span>gloss</span>" },
    })

    const selectionNode = document.getElementById("selection")!.firstChild!
    const range = document.createRange()
    range.setStart(selectionNode, 0)
    range.setEnd(selectionNode, selectionNode.textContent!.length)

    expect(buildContextSnapshot(createSelectionSnapshot(range))?.paragraphs).toEqual(["Alpha beta"])
  })
  it("reads each paragraph's context without rescanning its siblings", () => {
    const count = 200
    document.body.innerHTML = `<article>${Array.from(
      { length: count },
      (_, index) => `<p>Paragraph ${index}</p>`,
    ).join("")}</article>`
    const article = document.querySelector("article")!

    const range = document.createRange()
    range.setStart(article.firstChild!.firstChild!, 0)
    range.setEnd(article.lastChild!.firstChild!, 3)
    const snapshot = createSelectionSnapshot(range)

    const childNodes = vi.spyOn(Node.prototype, "childNodes", "get")
    const paragraphs = buildContextSnapshot(snapshot)?.paragraphs
    const articleReads = childNodes.mock.contexts.filter((node) => node === article).length
    childNodes.mockRestore()

    expect(paragraphs).toHaveLength(count)
    expect(paragraphs?.at(-1)).toBe(`Paragraph ${count - 1}`)
    expect(articleReads).toBeLessThan(10)
  })
})

describe("context around Read Frog and quotes", () => {
  it("leaves Read Frog's own UI out of a paragraph's context", () => {
    // A failed translation's retry button, and the toolbar and annotation layer
    // as they sit in a page's modal dialog.
    document.body.innerHTML = `<div id="dialog">Dialog text <span id="selected">here</span><span class="${REACT_SHADOW_HOST_CLASS}"></span><read-frog-selection ${PROTECTED_HOST_ATTRIBUTE}></read-frog-selection><div ${ANNOTATION_HOST_ATTRIBUTE}></div></div>`
    attachShadowTrees(document, {
      [`.${REACT_SHADOW_HOST_CLASS}`]: { html: `Translation failed. Retry` },
      "read-frog-selection": { html: `<div>Translate Speak</div>` },
      [`[${ANNOTATION_HOST_ATTRIBUTE}]`]: { html: `<div>gloss</div>` },
    })

    const range = document.createRange()
    range.selectNodeContents(document.getElementById("selected")!)

    expect(buildContextSnapshot(createSelectionSnapshot(range))?.paragraphs).toEqual([
      "Dialog text here",
    ])
  })

  it("keeps a page's own web component that the page marks notranslate", () => {
    // Pages mark code and names notranslate. It is still what the reader selected.
    document.body.innerHTML = `<p><span id="start"></span> Run <x-code class="notranslate"></x-code> to start</p>`
    attachShadowTrees(document, {
      "#start": { html: `<b>Tip:</b>` },
      "x-code": { html: `<code>npm install</code>` },
    })
    const startText = getShadowRoot("#start").querySelector("b")?.firstChild
    const endText = document.querySelector("p")?.lastChild
    if (!startText || !endText) {
      throw new Error("Fixtures not found")
    }
    const { selection } = createShadowSelection(
      { startContainer: startText, startOffset: 0, endContainer: endText, endOffset: 9 },
      "Tip:",
    )

    const snapshot = readSelectionSnapshot(selection)
    expect(snapshot?.text).toBe("Tip: Run npm install to start")
    expect(buildContextSnapshot(snapshot)?.paragraphs).toEqual(["Tip: Run npm install to start"])
  })

  it("puts a paragraph before the quote it holds, as the page does", () => {
    document.body.innerHTML = `<div class="post">Before the quote <blockquote id="quote">Quoted words</blockquote> after the quote</div>`
    const quoteText = document.getElementById("quote")?.firstChild
    const afterText = document.querySelector(".post")?.lastChild
    if (!quoteText || !afterText) {
      throw new Error("Fixtures not found")
    }

    // From the quote into the post's own text after it.
    const range = document.createRange()
    range.setStart(quoteText, 0)
    range.setEnd(afterText, 6)

    expect(buildContextSnapshot(createSelectionSnapshot(range))?.paragraphs).toEqual([
      "Before the quote Quoted words after the quote",
      "Quoted words",
    ])
  })
})

describe("boundaries at what the page doesn't render", () => {
  // By default the host's only light child is a framework's comment marker,
  // which no slot shows.
  function renderCard(
    before: string,
    lightChildren = "<!--?lit$1$-->",
    cardHtml = "<p>Card text</p>",
  ) {
    document.body.innerHTML = `<article>${before}<lit-card>${lightChildren}</lit-card><p>After the card</p></article>`
    attachShadowTrees(document, { "lit-card": { html: cardHtml } })
    return document.querySelector("lit-card")!
  }

  it.each([
    ["in front of the marker", "<!--?lit$1$-->", "<p>Card text</p>"],
    ["in a host with no light children", "", "<p>Card text</p>"],
    [
      "in a host that shows its first light child after its own text",
      "<span>Slotted</span>",
      "<p>Card text <slot></slot></p>",
    ],
  ])(
    "ends a triple-clicked paragraph's context at the host after it, %s",
    (_, lightChildren, cardHtml) => {
      const card = renderCard(`<p id="paragraph">Selected paragraph</p>`, lightChildren, cardHtml)
      const text = document.getElementById("paragraph")!.firstChild!

      // A triple click ends at the start of what the host renders, which
      // Chrome's legacy API reports as the start of the host.
      const snapshot = readSelectionSnapshot(
        createTreeSelection(
          { startContainer: text, startOffset: 0, endContainer: card, endOffset: 0 },
          "Selected paragraph",
        ),
      )

      expect(snapshot?.text).toBe("Selected paragraph")
      expect(buildContextSnapshot(snapshot)?.paragraphs).toEqual(["Selected paragraph"])
    },
  )

  it("ends the text of a selection across trees there too", () => {
    const card = renderCard(`<div id="reply"></div>`)
    attachShadowTrees(document, { "#reply": { html: `<p>Reply text</p>` } })
    const replyText = getShadowRoot("#reply").querySelector("p")!.firstChild!

    const { selection } = createShadowSelection(
      { startContainer: replyText, startOffset: 0, endContainer: card, endOffset: 0 },
      "",
    )

    expect(readSelectionSnapshot(selection)?.text).toBe("Reply text")
  })

  it("reads a range Firefox reports among a slot's assigned nodes", () => {
    document.body.innerHTML = `<x-list><p>One</p><p>Two</p></x-list>`
    attachShadowTrees(document, { "x-list": { html: `<h2>Title</h2><slot></slot>` } })
    const slot = getShadowRoot("x-list").querySelector("slot")!

    // Firefox counts the ends among the two paragraphs the slot shows. The slot
    // has no children of its own, so a live Range can't hold the end.
    const range = { startContainer: slot, startOffset: 0, endContainer: slot, endOffset: 2 }
    const snapshot = readSelectionSnapshot(createTreeSelection(range, "One\n\nTwo"))

    expect(snapshot?.text).toBe("One\n\nTwo")
    expect(buildContextSnapshot(snapshot)?.paragraphs).toEqual(["One", "Two"])
  })

  it("ends a range after a host's last light child right after where a slot shows it", () => {
    document.body.innerHTML = `<div id="first"></div><x-host>slotted</x-host>`
    attachShadowTrees(document, {
      "#first": { html: `<p>first</p>` },
      "x-host": { html: `<p><slot></slot></p><p>After the slot</p>` },
    })
    const firstText = getShadowRoot("#first").querySelector("p")!.firstChild!
    const host = document.querySelector("x-host")!

    const { selection } = createShadowSelection(
      { startContainer: firstText, startOffset: 0, endContainer: host, endOffset: 1 },
      "",
    )
    const snapshot = readSelectionSnapshot(selection)

    expect(snapshot?.text).toBe("first\n\nslotted")
    expect(buildContextSnapshot(snapshot)?.paragraphs).toEqual(["first", "slotted"])
  })
})

describe("context of slotted paragraphs", () => {
  const readContext = (text: Text) => {
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 4)
    const snapshot = readSelectionSnapshot({
      type: "Range",
      toString: () => range.toString(),
      rangeCount: 1,
      getRangeAt: () => range,
      getComposedRanges: () => [range],
    } as unknown as Selection)
    return buildContextSnapshot(snapshot)?.paragraphs
  }

  it("reads only the slotted paragraph, not what its host renders after it", () => {
    // The whitespace around the paragraph is in no slot, so it isn't rendered.
    document.body.innerHTML = `<article-card>
      <p slot="body">Body text</p>
    </article-card>`
    attachShadowTrees(document, {
      "article-card": {
        html: `<header>Header</header><slot name="body"></slot><footer>Footer</footer>`,
      },
    })

    expect(readContext(document.querySelector("p")!.firstChild as Text)).toEqual(["Body text"])
  })

  it("reads only the slotted paragraph when slots render siblings in another order", () => {
    document.body.innerHTML = `<div id="reordered"><p slot="a">Alpha text</p><p slot="b">Beta text</p></div>`
    attachShadowTrees(document, {
      "#reordered": { html: `<slot name="b"></slot><slot name="a"></slot>` },
    })

    expect(readContext(document.querySelector('[slot="b"]')!.firstChild as Text)).toEqual([
      "Beta text",
    ])
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

  it("returns null for a whitespace-only selection in a prefilled textarea", () => {
    document.body.innerHTML = `<div><textarea id="field">original draft</textarea></div>`

    const textarea = document.getElementById("field")
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error("Textarea not found")
    }

    textarea.value = "   "
    textarea.focus()
    textarea.setSelectionRange(0, 3)

    expect(readSelectionSnapshot(createTextControlSelection(textarea, "   "))).toBeNull()

    // No focused control, so the ranges path runs and must still skip the child text.
    textarea.blur()
    expect(readSelectionSnapshot(createTextControlSelection(textarea, "   "))).toBeNull()
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

  describe("closed shadow roots", () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    // What a content script's dom.openOrClosedShadowRoot() reaches.
    function attachClosedShadowRoots(roots: Map<Element, ShadowRoot>) {
      const openOrClosedShadowRoot = vi.fn<(element: HTMLElement) => ShadowRoot | null>(
        (element) => roots.get(element) ?? null,
      )
      vi.spyOn(fakeBrowser, "dom", "get").mockReturnValue({ openOrClosedShadowRoot })
      return openOrClosedShadowRoot
    }

    function renderWidget(widgetShadowHtml: string, widgetLightHtml: string) {
      document.body.innerHTML = `<p><span id="start"></span> <x-widget>${widgetLightHtml}</x-widget> <span id="end"></span></p>`
      attachShadowTrees(document, {
        "#start": { html: `<b>Start</b>` },
        "#end": { html: `<b>End</b>` },
      })
      const widget = document.querySelector("x-widget")
      const startText = getShadowRoot("#start").querySelector("b")?.firstChild
      const endText = getShadowRoot("#end").querySelector("b")?.firstChild
      if (!widget || !(startText instanceof Text) || !(endText instanceof Text)) {
        throw new Error("Fixtures not found")
      }
      const widgetShadowRoot = widget.attachShadow({ mode: "closed" })
      widgetShadowRoot.innerHTML = widgetShadowHtml
      const roots = new Map([[widget, widgetShadowRoot]])
      const openOrClosedShadowRoot = attachClosedShadowRoots(roots)
      const { selection } = createShadowSelection(
        { startContainer: startText, startOffset: 0, endContainer: endText, endOffset: 3 },
        "Start",
      )
      return {
        widget,
        widgetShadowRoot,
        startText,
        endText,
        roots,
        openOrClosedShadowRoot,
        selection,
      }
    }

    it("reads what a closed shadow root renders, not its host's light DOM", () => {
      const { selection } = renderWidget(`Rendered`, `fallback`)

      expect(readSelectionSnapshot(selection)?.text).toBe("Start Rendered End")
    })

    it("reads a closed shadow root in Firefox, which has it as a property of the host", () => {
      const { widget, widgetShadowRoot, selection } = renderWidget(`Rendered`, `fallback`)
      // Firefox has no dom API.
      vi.spyOn(fakeBrowser, "dom", "get").mockReturnValue(undefined as never)
      Object.defineProperty(widget, "openOrClosedShadowRoot", { value: widgetShadowRoot })

      expect(readSelectionSnapshot(selection)?.text).toBe("Start Rendered End")
    })

    // Each answer takes an extension call, ten times as slow as reading shadowRoot.
    it("asks about each element once while reading a selection, and once building its context", () => {
      const { selection, openOrClosedShadowRoot } = renderWidget(
        `<i>Rendered</i> <slot></slot>`,
        `<b>slotted</b>`,
      )
      const askedElements = () => openOrClosedShadowRoot.mock.calls.map(([element]) => element)

      const snapshot = readSelectionSnapshot(selection)
      expect(snapshot?.text).toBe("Start Rendered slotted End")
      expect(askedElements()).not.toHaveLength(0)
      expect(new Set(askedElements()).size).toBe(askedElements().length)

      openOrClosedShadowRoot.mockClear()
      expect(buildContextSnapshot(snapshot)?.paragraphs).toEqual(["Start Rendered slotted End"])
      expect(askedElements()).not.toHaveLength(0)
      expect(new Set(askedElements()).size).toBe(askedElements().length)
    })

    // Browsers hide a closed root's slots from assignedSlot, so finding the slot
    // that shows a node means asking the root's slots what they show.
    it("asks a closed shadow root's slots what they show no more often for more slotted nodes", () => {
      const countSlotQuestions = (slottedCount: number) => {
        const { widget, selection } = renderWidget(
          `<slot></slot>`,
          `<span>Slotted</span> `.repeat(slottedCount),
        )
        for (const node of widget.childNodes) {
          Object.defineProperty(node, "assignedSlot", { value: null })
        }
        const assignedNodes = vi.spyOn(HTMLSlotElement.prototype, "assignedNodes")

        const snapshot = readSelectionSnapshot(selection)
        expect(snapshot?.text).toBe(`Start ${"Slotted ".repeat(slottedCount)}End`)
        expect(buildContextSnapshot(snapshot)?.paragraphs).toHaveLength(1)

        const count = assignedNodes.mock.calls.length
        assignedNodes.mockRestore()
        return count
      }

      expect(countSlotQuestions(40)).toBe(countSlotQuestions(2))
    })

    it("finds a closed shadow root attached after an earlier read, as an upgrade does", () => {
      const { widget, widgetShadowRoot, roots, selection } = renderWidget(`Rendered`, `fallback`)
      roots.delete(widget)
      expect(readSelectionSnapshot(selection)?.text).toBe("Start fallback End")

      roots.set(widget, widgetShadowRoot)
      expect(readSelectionSnapshot(selection)?.text).toBe("Start Rendered End")
    })

    it("never reads a field, even if the browser shows its inner shadow root", () => {
      // Chrome and Firefox keep a field's inner shadow root from extensions.
      // Were one to show it, a password beside the selection would reach the
      // prompt.
      document.body.innerHTML = `<p id="login">Password <input type="password"> please</p>`
      const field = document.querySelector("input")
      const label = document.getElementById("login")?.firstChild
      if (!field || !label) {
        throw new Error("Fixtures not found")
      }
      const inner = document.createElement("div").attachShadow({ mode: "closed" })
      inner.textContent = "secret"
      attachClosedShadowRoots(new Map([[field, inner]]))
      const range = document.createRange()
      range.selectNodeContents(label)

      expect(buildContextSnapshot(createSelectionSnapshot(range))?.paragraphs).toEqual([
        "Password please",
      ])
    })

    it("starts a selection in light DOM slotted into a closed shadow root", () => {
      const { widget, endText } = renderWidget(`<i><slot></slot></i> shown`, `<span>slotted</span>`)
      const slottedSpan = widget.querySelector("span")
      const slotted = slottedSpan?.firstChild
      if (!slottedSpan || !(slotted instanceof Text)) {
        throw new Error("Slotted text not found")
      }
      // Browsers hide a slot in a closed shadow root from assignedSlot; jsdom doesn't.
      Object.defineProperty(slottedSpan, "assignedSlot", { value: null })
      const { selection } = createShadowSelection(
        { startContainer: slotted, startOffset: 0, endContainer: endText, endOffset: 3 },
        "slotted",
      )

      expect(readSelectionSnapshot(selection)?.text).toBe("slotted shown End")
    })
  })

  it("keeps the browser's text for a selection whose ends are in one tree", () => {
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

    // The selection's text leaves the shadow root out, as the browser's does.
    // Its paragraph is read from the page, shadow root and all.
    expect(snapshot?.text).toBe("Latest commit · History")
    expect(buildContextSnapshot(snapshot)?.paragraphs).toEqual([
      "Latest commit 5 days ago · History",
    ])
  })

  it("reads whitespace the way the page renders it", () => {
    expect(
      readTextFromShadowRoot(
        `<p><span id="normal">勉強  する\n        つもり</span></p>`,
        "#normal",
      ),
    ).toBe("勉強 する つもり")
    expect(
      readTextFromShadowRoot(
        `<p><span id="pre-wrap" style="white-space: pre-wrap">勉強  する</span></p>`,
        "#pre-wrap",
      ),
    ).toBe("勉強  する")
    expect(
      readTextFromShadowRoot(
        `<article><p id="first">Alpha</p>\n        <p>Beta<br>Gamma</p><div>Delta</div></article>`,
        "#first",
      ),
    ).toBe("Alpha\n\nBeta\nGamma\n\nDelta")
  })

  it("starts a new line for text in each flex, grid or table box, but not an inline one", () => {
    expect(
      readTextFromShadowRoot(
        `<div id="boxes"><div style="display: flex">hello</div><div style="display: grid">world</div><div style="display: table-cell">cell</div><span style="display: inline-flex">inline</span><span>after</span></div>`,
        "#boxes",
      ),
    ).toBe("hello\nworld\ncell\ninlineafter")
  })

  it("starts a new line for text in each section, article, nav or aside", () => {
    expect(
      readTextFromShadowRoot(
        `<div id="parts"><section>hello</section><section>world</section><article>One</article><nav>Home</nav><aside>Side note</aside></div>`,
        "#parts",
      ),
    ).toBe("hello\nworld\nOne\nHome\nSide note")
  })

  it("leaves out what the page doesn't show: a closed <details>, a select box, media fallback", () => {
    expect(
      readTextFromShadowRoot(
        `<div id="post"><p>Shown</p><details><summary>More</summary>Folded text<p>Folded paragraph</p></details><details open><summary>Open</summary><p>Unfolded</p></details><p>Pick <select><option>one</option><option>two</option></select> now</p><video>No video support</video><canvas>No canvas support</canvas><p>End</p></div>`,
        "#post",
      ),
    ).toBe("Shown\n\nMore\nOpen\nUnfolded\n\nPick now\n\nEnd")
  })

  it("leaves out an SVG's description and metadata", () => {
    expect(
      readTextFromShadowRoot(
        `<p id="likes">Liked <svg><desc>Thumbs up</desc><metadata>icon v2</metadata></svg> 23 times</p>`,
        "#likes",
      ),
    ).toBe("Liked 23 times")
  })

  it("reads an <object>'s fallback only while the object shows it", () => {
    const html = `<p id="figure">Chart <object data="chart.svg"><span>Fallback text</span></object> below</p>`
    // jsdom has no layout, so Range.getClientRects() stands in for whether the
    // object's children take up room on the page.
    const showFallback = (shown: boolean) =>
      Object.defineProperty(Range.prototype, "getClientRects", {
        configurable: true,
        value: () => (shown ? [{ width: 10, height: 10 }] : []),
      })
    const originalGetClientRects = Object.getOwnPropertyDescriptor(
      Range.prototype,
      "getClientRects",
    )

    try {
      showFallback(false)
      expect(readTextFromShadowRoot(html, "#figure")).toBe("Chart below")
      showFallback(true)
      expect(readTextFromShadowRoot(html, "#figure")).toBe("Chart Fallback text below")
    } finally {
      if (originalGetClientRects) {
        Object.defineProperty(Range.prototype, "getClientRects", originalGetClientRects)
      } else {
        Reflect.deleteProperty(Range.prototype, "getClientRects")
      }
    }
  })

  it("reads a slotted paragraph whose range starts in the shadow root after it", () => {
    document.body.innerHTML = `<x-post><p slot="body">Slotted body paragraph one.</p><p slot="body">Slotted body paragraph two.</p></x-post>`
    const post = document.querySelector("x-post")!
    const shadowRoot = post.attachShadow({ mode: "open" })
    shadowRoot.innerHTML = `<h3>Post title</h3><div><slot name="body"></slot></div><div id="actions">Reply Share Report</div>`
    const actions = shadowRoot.querySelector("#actions")
    const secondText = post.lastElementChild?.firstChild
    if (!actions || !secondText) {
      throw new Error("Selection boundaries not found")
    }

    // A triple click on the second paragraph. getComposedRanges() puts the
    // shadow root before the host's children, so the range runs from the
    // actions, rendered after the paragraph, back to the paragraph's start.
    const { selection } = createShadowSelection(
      { startContainer: actions, startOffset: 0, endContainer: secondText, endOffset: 0 },
      "Slotted body paragraph one.\n\n",
    )

    expect(readSelectionSnapshot(selection)?.text).toBe("Slotted body paragraph two.")
  })

  it("keeps the browser's text for a selection in a closed shadow root, which it can't read", () => {
    document.body.innerHTML = `<p>Before</p><div id="widget"></div>`
    const shadowRoot = document.getElementById("widget")!.attachShadow({ mode: "closed" })
    shadowRoot.innerHTML = `<p>Closed text</p>`
    const closedText = shadowRoot.querySelector("p")?.firstChild
    if (!closedText) {
      throw new Error("Selection node not found")
    }

    // getComposedRanges() can't be handed the closed root, so it reports a range
    // around the host.
    const { selection } = createShadowSelection(
      { startContainer: closedText, startOffset: 0, endContainer: closedText, endOffset: 11 },
      "Closed text",
    )

    expect(readSelectionSnapshot(selection)).toEqual({
      text: "Closed text",
      ranges: [
        {
          startContainer: document.body,
          startOffset: 1,
          endContainer: document.body,
          endOffset: 2,
        },
      ],
    })
  })

  it("reads a selection whose text is all in shadow roots inside it, which the browser reads as blank", () => {
    document.body.innerHTML = `<p id="date"><relative-time></relative-time></p>`
    document.querySelector("relative-time")!.attachShadow({ mode: "open" }).textContent =
      "5 days ago"

    const range = document.createRange()
    range.selectNodeContents(document.getElementById("date")!)

    expect(readSelectionSnapshot(createTreeSelection(range, ""))?.text).toBe("5 days ago")
  })

  it("doesn't search the page for furigana when a click leaves a caret", () => {
    document.body.innerHTML = `<p><ruby>漢字<rt>かんじ</rt></ruby>を読む</p>`
    const caret = {
      startContainer: document.body,
      startOffset: 0,
      endContainer: document.body,
      endOffset: 0,
    }
    const querySelectorAll = vi.spyOn(Element.prototype, "querySelectorAll")

    try {
      expect(readSelectionSnapshot(createTreeSelection(caret, ""))).toBeNull()
      expect(querySelectorAll).not.toHaveBeenCalled()
    } finally {
      querySelectorAll.mockRestore()
    }
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

  // A live Range is updated on every change to the page until it is collected,
  // and the toolbar measures on every scroll frame.
  it("measures every piece with one Range", () => {
    document.body.innerHTML = `<p id="light">Alpha</p><div id="host"></div>`
    attachShadowTrees(document, { "#host": { html: `<p>Beta<br>Gamma</p>` } })
    const lightText = document.getElementById("light")!.firstChild!
    const lastText = getShadowRoot("#host").querySelector("p")!.lastChild!
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value: () => [{ width: 10, height: 10 }],
    })
    const createRange = vi.spyOn(document, "createRange")

    const rects = readRangeClientRects({
      startContainer: lightText,
      startOffset: 2,
      endContainer: lastText,
      endOffset: 2,
    })

    expect(rects).toHaveLength(4)
    expect(createRange).toHaveBeenCalledTimes(1)
    createRange.mockRestore()
  })

  it("measures nothing once an end is gone from the page", () => {
    document.body.innerHTML = `<div id="host"></div><p id="end">End</p><p>After</p>`
    attachShadowTrees(document, { "#host": { html: `<p>Start</p>` } })
    const startText = getShadowRoot("#host").querySelector("p")!.firstChild!
    const endText = document.getElementById("end")!.firstChild!
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value: () => [{ width: 10, height: 10 }],
    })

    document.getElementById("end")!.remove()

    expect(
      readRangeClientRects({
        startContainer: startText,
        startOffset: 0,
        endContainer: endText,
        endOffset: 3,
      }),
    ).toEqual([])
  })

  it("measures a range Firefox reports among a slot's assigned nodes", () => {
    document.body.innerHTML = `<x-list><p>One</p><p>Two</p></x-list>`
    attachShadowTrees(document, { "x-list": { html: `<h2>Title</h2><slot></slot>` } })
    const slot = getShadowRoot("x-list").querySelector("slot")!
    const measured: string[] = []
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value(this: Range) {
        measured.push(this.toString())
        return [{ width: 10, height: 10 }]
      },
    })

    const rects = readRangeClientRects({
      startContainer: slot,
      startOffset: 0,
      endContainer: slot,
      endOffset: 2,
    })

    expect(measured).toEqual(["One", "Two"])
    expect(rects).toHaveLength(2)
  })
})

// https://github.com/mengxi-ream/read-frog/issues/2371
describe("ruby annotations", () => {
  // Like the browser's selection text, Range.toString() keeps the furigana.
  function createRangeSelection(range: Range, { composed = true } = {}): Selection {
    return {
      toString: () => range.toString(),
      anchorNode: range.startContainer,
      focusNode: range.endContainer,
      rangeCount: 1,
      getRangeAt: () => range,
      ...(composed && { getComposedRanges: () => [range] }),
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

  it("leaves furigana out in a browser without getComposedRanges() as well", () => {
    document.body.innerHTML = `<p id="paragraph"><ruby>漢字<rt>かんじ</rt></ruby>を勉強する</p>`

    const range = document.createRange()
    range.selectNodeContents(document.getElementById("paragraph")!)

    expect(readSelectionSnapshot(createRangeSelection(range, { composed: false }))?.text).toBe(
      "漢字を勉強する",
    )
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

  it("keeps the browser's text for a selection without furigana in a paragraph that has some", () => {
    document.body.innerHTML = `<p><ruby>漢字<rt>かんじ</rt></ruby>を<span id="plain">勉強  する</span></p>`

    const range = document.createRange()
    range.selectNodeContents(getTextNode("plain"))

    expect(readSelectionSnapshot(createRangeSelection(range))?.text).toBe("勉強  する")
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
