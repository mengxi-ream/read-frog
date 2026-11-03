// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import {
  BlockDiscovery,
  BlockResolver,
  findBlocksIn,
  getLanguageHint,
  isInScanSkippedSubtree,
  rangeForSpan,
  readBlockText,
} from "../blocks"

function mount(html: string) {
  document.body.innerHTML = html
  return document.body
}

afterEach(() => {
  document.body.replaceChildren()
})

describe("BlockResolver", () => {
  it("finds the nearest ancestor that lays out its own lines", () => {
    mount("<p id='p'>Some <b><a href='#'>bold link</a></b> text</p>")
    const resolver = new BlockResolver()

    expect(resolver.blockOf(document.querySelector("a")!)).toBe(document.querySelector("#p"))
    expect(resolver.blockOf(document.querySelector("b")!)).toBe(document.querySelector("#p"))
  })

  it("answers again after forgetting what changed", () => {
    mount("<div id='outer'><span id='inner'>text</span></div>")
    const resolver = new BlockResolver()
    const inner = document.querySelector<HTMLElement>("#inner")!
    expect(resolver.blockOf(inner)).toBe(document.querySelector("#outer"))

    inner.style.display = "block"
    // Remembered until told otherwise.
    expect(resolver.blockOf(inner)).toBe(document.querySelector("#outer"))
    resolver.forget(document.querySelector("#outer")!)
    expect(resolver.blockOf(inner)).toBe(inner)
  })
})

describe("readBlockText", () => {
  it("reads the block's own text, a line break where a nested block or <br> interrupts it", () => {
    mount("<div id='d'>First <i>part</i><p>nested</p>second<br>third</div>")
    const block = document.querySelector("#d")!

    const { text, nodes } = readBlockText(block, new BlockResolver())

    expect(text).toBe("First part\nsecond\nthird")
    expect(nodes.map((node) => node.data)).toEqual(["First ", "part", "second", "third"])
  })

  it("leaves out code, form controls and editable text, keeping the words around them apart", () => {
    mount(
      "<p id='p'>Run <code>npm install</code>now <button>Go</button><span contenteditable='true'>draft</span>done</p>",
    )
    // jsdom does not work out isContentEditable; a browser does.
    Object.defineProperty(document.querySelector("[contenteditable]")!, "isContentEditable", {
      value: true,
    })

    const { text } = readBlockText(document.querySelector("#p")!, new BlockResolver())

    expect(text).toBe("Run \nnow \ndone")
  })
})

describe("rangeForSpan", () => {
  it("spans text nodes", () => {
    mount("<p id='p'>un<b>believ</b>able</p>")
    const blockText = readBlockText(document.querySelector("#p")!, new BlockResolver())

    const range = rangeForSpan(blockText, 0, 12)!

    expect(range.toString()).toBe("unbelievable")
    expect(range.startContainer).toBe(blockText.nodes[0])
    expect(range.endContainer).toBe(blockText.nodes[2])
  })

  it("refuses a span on a stand-in line break or outside the text", () => {
    mount("<div id='d'>one<p>x</p>two</div>")
    const blockText = readBlockText(document.querySelector("#d")!, new BlockResolver())
    expect(blockText.text).toBe("one\ntwo")

    expect(rangeForSpan(blockText, 3, 4)).toBeNull()
    expect(rangeForSpan(blockText, 4, 9)).toBeNull()
    expect(rangeForSpan(blockText, 2, 2)).toBeNull()
    expect(rangeForSpan(blockText, 4, 7)?.toString()).toBe("two")
  })
})

describe("BlockDiscovery", () => {
  it("finds the blocks with text in document order, across slices, leaving out code and blank text", () => {
    const root = mount(
      "<article><h1 id='h'>Title</h1><p id='a'>One <b>two</b></p><p> </p><pre>code</pre><p id='b'>Three</p></article>",
    )
    const discovery = new BlockDiscovery(root, new BlockResolver())
    const found: string[] = []

    let slices = 0
    while (!discovery.finished) {
      // Two nodes per slice.
      let budget = 2
      slices += 1
      discovery.run(
        () => budget-- <= 0,
        (block) => found.push(block.id),
      )
    }

    // Once per text node: the scanner keeps the blocks it has.
    expect(found).toEqual(["h", "a", "a", "b"])
    expect(slices).toBeGreaterThan(1)
  })

  it("starts over when the page removed the node it stopped at, skipping text already seen", () => {
    const root = mount("<p id='a'>One</p><p id='b'>Two</p><p id='c'>Three</p>")
    const discovery = new BlockDiscovery(root, new BlockResolver())
    const found: string[] = []
    let budget = 1
    discovery.run(
      () => budget-- <= 0,
      (block) => found.push(block.id),
    )
    expect(found).toEqual(["a"])

    document.querySelector("#a")!.remove()
    discovery.run(
      () => false,
      (block) => found.push(block.id),
    )

    expect(found).toEqual(["a", "b", "c"])
    expect(discovery.finished).toBe(true)
  })
})

describe("findBlocksIn", () => {
  it("finds the blocks of added content, and nothing inside skipped elements", () => {
    mount("<div id='host'><p id='a'>Added</p><pre><span>code</span></pre></div>")
    const resolver = new BlockResolver()

    expect(
      [...findBlocksIn(document.querySelector("#host")!, resolver)].map((el) => el.id),
    ).toEqual(["a"])
    expect(findBlocksIn(document.querySelector("pre span")!, resolver).size).toBe(0)
    expect(isInScanSkippedSubtree(document.querySelector("pre span")!.firstChild!)).toBe(true)
  })

  it("finds the block of an added text node", () => {
    mount("<p id='a'></p>")
    const text = document.createTextNode("New words")
    document.querySelector("#a")!.append(text)

    expect([...findBlocksIn(text, new BlockResolver())].map((el) => el.id)).toEqual(["a"])
  })
})

describe("getLanguageHint", () => {
  it("takes the closest declared language", () => {
    mount("<div lang='de'><p id='p'>Hallo</p></div><p id='q'>Hi</p>")

    expect(getLanguageHint(document.querySelector("#p")!)).toBe("de")
    expect(getLanguageHint(document.querySelector("#q")!)).toBeUndefined()
  })
})
