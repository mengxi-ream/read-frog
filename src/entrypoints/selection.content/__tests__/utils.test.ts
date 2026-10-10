// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { buildContextSnapshot, createRangeSnapshot, readSelectionSnapshot } from "../utils"

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

  it("passes only the selected open shadow root to getComposedRanges", () => {
    document.body.innerHTML = ""

    const selectedHost = document.createElement("div")
    const selectedShadowRoot = selectedHost.attachShadow({ mode: "open" })
    const selectedText = document.createTextNode("Beta")
    selectedShadowRoot.append(selectedText)
    document.body.appendChild(selectedHost)

    const unrelatedHost = document.createElement("div")
    unrelatedHost.attachShadow({ mode: "open" })
    document.body.appendChild(unrelatedHost)

    const range = document.createRange()
    range.setStart(selectedText, 0)
    range.setEnd(selectedText, selectedText.textContent?.length ?? 0)

    const getComposedRanges = vi.fn<(...args: any[]) => any>(() => [range])
    const selection = {
      toString: () => "Beta",
      anchorNode: selectedText,
      focusNode: selectedText,
      rangeCount: 1,
      getRangeAt: () => range,
      getComposedRanges,
    } as unknown as Selection

    readSelectionSnapshot(selection)

    expect(getComposedRanges).toHaveBeenCalledWith({
      shadowRoots: [selectedShadowRoot],
    })
  })

  it("passes nested open shadow root ancestors to getComposedRanges", () => {
    document.body.innerHTML = ""

    const outerHost = document.createElement("div")
    const outerShadowRoot = outerHost.attachShadow({ mode: "open" })
    document.body.appendChild(outerHost)

    const innerHost = document.createElement("div")
    const innerShadowRoot = innerHost.attachShadow({ mode: "open" })
    outerShadowRoot.appendChild(innerHost)

    const selectedText = document.createTextNode("Beta")
    innerShadowRoot.append(selectedText)

    const unrelatedHost = document.createElement("div")
    unrelatedHost.attachShadow({ mode: "open" })
    document.body.appendChild(unrelatedHost)

    const range = document.createRange()
    range.setStart(selectedText, 0)
    range.setEnd(selectedText, selectedText.textContent?.length ?? 0)

    const getComposedRanges = vi.fn<(...args: any[]) => any>(() => [range])
    const selection = {
      toString: () => "Beta",
      anchorNode: selectedText,
      focusNode: selectedText,
      rangeCount: 1,
      getRangeAt: () => range,
      getComposedRanges,
    } as unknown as Selection

    readSelectionSnapshot(selection)

    expect(getComposedRanges).toHaveBeenCalledWith({
      shadowRoots: [innerShadowRoot, outerShadowRoot],
    })
  })

  it("passes the Read Frog subtitles shadow root when selection boundaries expose only the host", () => {
    document.body.innerHTML = `
      <div id="read-frog-subtitles-ui-host"></div>
      <main><span id="fallback">against</span></main>
    `

    const subtitlesHost = document.getElementById("read-frog-subtitles-ui-host")
    const fallbackNode = document.getElementById("fallback")?.firstChild
    if (!subtitlesHost || !fallbackNode) {
      throw new Error("Selection fixtures not found")
    }

    const subtitlesShadowRoot = subtitlesHost.attachShadow({ mode: "open" })
    const subtitleLine = document.createElement("div")
    subtitleLine.className = "subtitles-main"
    subtitleLine.textContent =
      "fears that anti-immigration protests could descend into widespread violence against foreigners."
    subtitlesShadowRoot.appendChild(subtitleLine)

    const subtitleNode = subtitleLine.firstChild
    if (!subtitleNode) {
      throw new Error("Subtitle text node not found")
    }

    const selectedWordStart = subtitleNode.textContent?.indexOf("against") ?? -1
    if (selectedWordStart < 0) {
      throw new Error("Selected word not found in subtitle")
    }

    const subtitleRange = document.createRange()
    subtitleRange.setStart(subtitleNode, selectedWordStart)
    subtitleRange.setEnd(subtitleNode, selectedWordStart + "against".length)

    const fallbackRange = document.createRange()
    fallbackRange.setStart(fallbackNode, 0)
    fallbackRange.setEnd(fallbackNode, fallbackNode.textContent?.length ?? 0)

    const getComposedRanges = vi.fn<(...args: any[]) => any>(
      (options?: { shadowRoots?: ShadowRoot[] }) =>
        options?.shadowRoots?.includes(subtitlesShadowRoot) ? [subtitleRange] : [],
    )
    const selection = {
      toString: () => "against",
      anchorNode: subtitlesHost,
      focusNode: subtitlesHost,
      rangeCount: 1,
      getRangeAt: () => fallbackRange,
      getComposedRanges,
    } as unknown as Selection

    const snapshot = readSelectionSnapshot(selection)

    expect(getComposedRanges).toHaveBeenCalledWith({
      shadowRoots: [subtitlesShadowRoot],
    })
    expect(snapshot?.ranges[0]).toMatchObject({
      startContainer: subtitleNode,
      startOffset: selectedWordStart,
      endContainer: subtitleNode,
      endOffset: selectedWordStart + "against".length,
    })
    expect(buildContextSnapshot(snapshot)).toEqual({
      text: "fears that anti-immigration protests could descend into widespread violence against foreigners.",
      paragraphs: [
        "fears that anti-immigration protests could descend into widespread violence against foreigners.",
      ],
    })
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
})
