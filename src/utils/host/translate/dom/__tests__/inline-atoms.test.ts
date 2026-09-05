// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  CONTENT_WRAPPER_CLASS,
  INLINE_ATOM_CLASS,
  WALKED_ATTRIBUTE,
} from "@/utils/constants/dom-labels"
import { logger } from "@/utils/logger"
import { extractTextContent } from "../../../dom/traversal"
import {
  containsInlineAtomOutsideWrappers,
  extractInlineAtomText,
  isRenderableInlineAtom,
  renderInlineAtomTranslation,
  sanitizeInlineAtomClone,
} from "../inline-atoms"

// Trimmed one-formula snippets from the six renderer families captured on
// 2026-09-04 (arXiv LaTeXML, KaTeX 0.16 CLI, MathJax 2.7.9 SVG, MathJax 3.2.2
// CHTML/SVG, Wikipedia Parsoid). Structure is verbatim; long glyph lists cut.
const ARXIV_P =
  '<p id="S4.SS2.SSS0.Px3.p1.1" class="ltx_p">Our formulation not only enables conditioning on a single variable <math id="S4.SS2.SSS0.Px3.p1.m1" class="ltx_Math" alttext="\\omega" display="inline" intent=":literal"><semantics><mi>ω</mi><annotation encoding="application/x-tex">\\omega</annotation></semantics></math>, but also allows for other guidance-related factors. We can handle CFG interval <cite class="ltx_cite ltx_citemacro_cite">[<a href="#bib.bib48" title="" class="ltx_ref">26</a>]</cite> under the same paradigm.</p>'

const KATEX_SPAN =
  '<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><msub><mi>τ</mi><mn>1</mn></msub><mo>=</mo><mn>10.27</mn></mrow><annotation encoding="application/x-tex">\\tau_1 = 10.27</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="katex-base"><span class="katex-strut" style="height:0.5806em;vertical-align:-0.15em;"></span><span class="mord"><span class="mord mathnormal" style="margin-right:0.1132em;">τ</span><span class="msupsub"><span class="vlist-t vlist-t2"><span class="vlist-r"><span class="vlist" style="height:0.3011em;"><span style="top:-2.55em;"><span class="pstrut" style="height:2.7em;"></span><span class="katex-sizing reset-size6 size3 mtight"><span class="mord mtight">1</span></span></span></span><span class="vlist-s">​</span></span></span></span></span><span class="mrel">=</span><span class="mord">10.27</span></span></span></span>'
const KATEX_P = `<p>Once fitted, the time constants were ${KATEX_SPAN} and ${KATEX_SPAN.replace("τ", "σ")}, which agree with the model.</p>`

const MATHJAX2_FORMULA =
  '<span class="MathJax_Preview" style="color: inherit;"></span><span class="MathJax_SVG" id="MathJax-Element-1-Frame" tabindex="0" data-mathml="&lt;math&gt;&lt;mi&gt;τ&lt;/mi&gt;&lt;/math&gt;" role="presentation" style="font-size: 100%; display: inline-block; position: relative;"><svg xmlns:xlink="http://www.w3.org/1999/xlink" width="1.5ex" height="1.8ex" viewBox="0 -500 660 780" role="img" focusable="false" style="vertical-align: -0.6ex;" aria-hidden="true"><g stroke="currentColor" fill="currentColor" stroke-width="0" transform="matrix(1 0 0 -1 0 0)"><use xlink:href="#MJMATHI-3C4" x="0" y="0"></use></g></svg><span class="MJX_Assistive_MathML" role="presentation"><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>τ</mi></math></span></span><script type="math/tex" id="MathJax-Element-1">\\tau</script>'
const MATHJAX2_P = `<p id="target">The time constant ${MATHJAX2_FORMULA} was extracted from the decay.</p>`
const SCIENCEDIRECT_P = `<p>The time constant <span class="math">${MATHJAX2_FORMULA}</span> was extracted from the decay.</p>`

const MATHJAX3_CHTML =
  '<mjx-container class="MathJax CtxtMenu_Attached_0" jax="CHTML" tabindex="0" ctxtmenu_counter="26" style="font-size: 119%; position: relative;"><mjx-math class="MJX-TEX" aria-hidden="true"><mjx-msub><mjx-mi class="mjx-i"><mjx-c class="mjx-c1D70B TEX-I"></mjx-c></mjx-mi><mjx-script style="vertical-align: -0.15em;"><mjx-mn class="mjx-n" size="s"><mjx-c class="mjx-c30"></mjx-c></mjx-mn></mjx-script></mjx-msub></mjx-math><mjx-assistive-mml unselectable="on" display="inline"><math xmlns="http://www.w3.org/1998/Math/MathML"><msub><mi>π</mi><mn>0</mn></msub></math></mjx-assistive-mml></mjx-container>'
const MATHJAX3_P = `<p>from the noise distribution ${MATHJAX3_CHTML} on the left.</p>`

const MATHJAX3_SVG =
  '<mjx-container class="MathJax" jax="SVG" tabindex="0" style="position: relative;"><svg xmlns="http://www.w3.org/2000/svg" width="1.5ex" height="1.8ex" viewBox="0 -500 660 780" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true"><defs><path id="MJX-1-TEX-I-1D70F" d="M39 168Q39 225 58 272"></path></defs><g stroke="currentColor" fill="currentColor"><g data-mml-node="math"><g data-mml-node="mi"><use data-c="1D70F" xlink:href="#MJX-1-TEX-I-1D70F"></use></g></g></g></svg><mjx-assistive-mml unselectable="on" display="inline"><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>τ</mi></math></mjx-assistive-mml></mjx-container>'
const MATHJAX3_SVG_P = `<p>The measured constant ${MATHJAX3_SVG} agrees with the model.</p>`

const WIKIPEDIA_P =
  '<p id="mwaQ">Therefore, the mean lifetime <span class="mwe-math-element mwe-math-element-inline" typeof="mw:Extension/math" id="mwag"><span class="mwe-math-mathml-inline mwe-math-mathml-a11y" style="display: none;"><math xmlns="http://www.w3.org/1998/Math/MathML" class="mathjax_ignore" alttext="{\\displaystyle \\tau }"><semantics><mrow class="MJX-TeXAtom-ORD"><mstyle displaystyle="true" scriptlevel="0"><mi>τ<!-- τ --></mi></mstyle></mrow><annotation encoding="application/x-tex">{\\displaystyle \\tau }</annotation></semantics></math></span><img src="https://wikimedia.org/api/rest_v1/media/math/render/svg/38a7" class="mwe-math-fallback-image-inline mw-invert skin-invert" aria-hidden="true" style="vertical-align: -0.338ex; width:1.202ex; height:1.676ex;" alt="{\\displaystyle \\tau }"/></span> is equal to the half-life divided by the natural log of 2, or:</p>'

function paragraph(markup: string): HTMLElement {
  const host = document.createElement("div")
  host.innerHTML = markup
  document.body.append(host)
  return host.firstElementChild as HTMLElement
}

function setHost(host: string) {
  Object.defineProperty(window, "location", {
    value: new URL(`https://${host}/article`),
    writable: true,
    configurable: true,
  })
}

function configWithSiteRule(rule: Config["siteRules"]["userRules"][number]): Config {
  const config = structuredClone(DEFAULT_CONFIG)
  config.siteRules = { userRules: [rule], disabledBuiltInRules: [] }
  return config
}

afterEach(() => {
  document.body.innerHTML = ""
  setHost("neutral-test.example")
  vi.restoreAllMocks()
})

describe("extractInlineAtomText", () => {
  it("is byte-identical to the legacy extraction for a paragraph without atoms", () => {
    const p = paragraph("<p>Hello <b>bold</b> and <a href='#'>link</a>.</p>")
    const result = extractInlineAtomText([p], DEFAULT_CONFIG)
    const legacy = extractTextContent(p, DEFAULT_CONFIG)
    expect(result.filterText).toBe(legacy)
    expect(result.requestText).toBe(legacy)
    expect(result.atoms).toEqual([])
    expect(result.baseIndex).toBe(0)
    expect(result.hasProse).toBe(true)
  })

  it("replaces a native <math> root with a token while keeping the legacy filter text", () => {
    const p = paragraph(ARXIV_P)
    const result = extractInlineAtomText([p], DEFAULT_CONFIG)
    expect(result.filterText).toBe(extractTextContent(p, DEFAULT_CONFIG))
    expect(result.filterText).toContain("single variable , but also")
    expect(result.requestText).toBe(
      "Our formulation not only enables conditioning on a single variable {{0}}, but also allows for other guidance-related factors. We can handle CFG interval [26] under the same paradigm.",
    )
    expect(result.atoms).toHaveLength(1)
    expect(result.atoms[0]).toBe(p.querySelector("math"))
    expect(result.hasProse).toBe(true)
  })

  it("replaces KaTeX spans with tokens instead of leaking glyph soup", () => {
    const p = paragraph(KATEX_P)
    const result = extractInlineAtomText([p], DEFAULT_CONFIG)
    expect(result.requestText).toBe(
      "Once fitted, the time constants were {{0}} and {{1}}, which agree with the model.",
    )
    expect(result.filterText).not.toContain("τ")
    expect(result.filterText).not.toContain("​")
    expect(result.atoms.map((atom) => atom.className)).toEqual(["katex", "katex"])
  })

  it("emits one token per MathJax v2 formula: empty preview, SVG span, script", () => {
    const p = paragraph(MATHJAX2_P)
    const result = extractInlineAtomText([p], DEFAULT_CONFIG)
    expect(result.requestText).toBe("The time constant {{0}} was extracted from the decay.")
    expect(result.atoms).toHaveLength(1)
    expect(result.atoms[0]?.classList.contains("MathJax_SVG")).toBe(true)
  })

  it("treats the ScienceDirect span.math wrapper as the atom on that site", () => {
    setHost("www.sciencedirect.com")
    const p = paragraph(SCIENCEDIRECT_P)
    const result = extractInlineAtomText([p], DEFAULT_CONFIG)
    expect(result.requestText).toBe("The time constant {{0}} was extracted from the decay.")
    expect(result.atoms[0]?.classList.contains("math")).toBe(true)
  })

  it("emits one token for MathJax v3 CHTML and SVG containers", () => {
    for (const markup of [MATHJAX3_P, MATHJAX3_SVG_P]) {
      const p = paragraph(markup)
      const result = extractInlineAtomText([p], DEFAULT_CONFIG)
      expect(result.requestText).toMatch(/^[^{]+ \{\{0\}\} [^{]+$/)
      expect(result.atoms).toHaveLength(1)
      expect(result.atoms[0]?.localName).toBe("mjx-container")
    }
  })

  it("emits one token for a Wikipedia math element and never counts the inner math or img", () => {
    const p = paragraph(WIKIPEDIA_P)
    const result = extractInlineAtomText([p], DEFAULT_CONFIG)
    expect(result.requestText).toBe(
      "Therefore, the mean lifetime {{0}} is equal to the half-life divided by the natural log of 2, or:",
    )
    expect(result.filterText).toBe(extractTextContent(p, DEFAULT_CONFIG))
    expect(result.atoms).toHaveLength(1)
  })

  it("tokenizes atoms nested in inline formatting, at the edges, and back to back", () => {
    const m = (symbol: string) =>
      `<math class="ltx_Math" alttext="${symbol}"><semantics><mi>${symbol}</mi><annotation encoding="application/x-tex">${symbol}</annotation></semantics></math>`
    const p = paragraph(
      `<figcaption>${m("u")} predicts <span class="ltx_font_bold">average velocity</span> ${m("v")}${m("w")} via <em><a href="#x">${m("x")}<span class="ltx_font_bold">-loss re-parameterized by ${m("y")}-pred</span></a></em>, input ${m("z")}</figcaption>`,
    )
    const result = extractInlineAtomText([p], DEFAULT_CONFIG)
    expect(result.requestText).toBe(
      "{{0}} predicts average velocity {{1}}{{2}} via {{3}}-loss re-parameterized by {{4}}-pred, input {{5}}",
    )
    expect(result.atoms.map((atom) => atom.getAttribute("alttext"))).toEqual([
      "u",
      "v",
      "w",
      "x",
      "y",
      "z",
    ])
    expect(result.filterText).toBe(extractTextContent(p, DEFAULT_CONFIG))
  })

  it("reports no prose for a formula-only run", () => {
    const p = paragraph("<p>(<math><mi>x</mi></math>)</p>")
    const result = extractInlineAtomText([p], DEFAULT_CONFIG)
    expect(result.atoms).toHaveLength(1)
    expect(result.hasProse).toBe(false)
  })

  it("numbers tokens past a token-shaped literal already in the prose", () => {
    const p = paragraph("<p>Use {{0}} in templates, unlike <math><mi>x</mi></math>.</p>")
    const result = extractInlineAtomText([p], DEFAULT_CONFIG)
    expect(result.baseIndex).toBe(1)
    expect(result.requestText).toBe("Use {{0}} in templates, unlike {{1}}.")
  })

  it("falls back to the legacy string when the prose itself contains U+FFFC", () => {
    const p = paragraph("<p>Object ￼ here <math><mi>x</mi></math>.</p>")
    const result = extractInlineAtomText([p], DEFAULT_CONFIG)
    expect(result.atoms).toEqual([])
    expect(result.requestText).toBe(extractTextContent(p, DEFAULT_CONFIG))
  })

  it("drops a hidden atom exactly like the legacy extraction", () => {
    const p = paragraph(
      `<p>Hidden <span class="katex" style="display:none"><span class="katex-html">x</span></span> here.</p>`,
    )
    const result = extractInlineAtomText([p], DEFAULT_CONFIG)
    expect(result.atoms).toEqual([])
    expect(result.requestText).toBe("Hidden  here.")
  })

  it("honors atomSelectors.remove and never promotes a renderer's hidden <math> copy", () => {
    setHost("plain.example")
    const config = configWithSiteRule({
      id: "no-katex",
      matches: "plain.example",
      "atomSelectors.remove": ["span.katex"],
    })
    const p = paragraph(KATEX_P)
    const result = extractInlineAtomText([p], config)
    // span.katex is still preserve-text, so its .katex-mathml <math> stays
    // dropped as it always was instead of becoming an atom of its own.
    expect(result.atoms).toEqual([])
    expect(result.requestText).toBe(extractTextContent(p, config))
    expect(result.requestText).toContain("τ1")
  })

  it("does not consult computed styles for atoms it can classify by tag", () => {
    const p = paragraph(ARXIV_P)
    const spy = vi.spyOn(window, "getComputedStyle")
    extractInlineAtomText([p], DEFAULT_CONFIG)
    const inspected = spy.mock.calls.map(([element]) => element.localName)
    expect(inspected).not.toContain("math")
  })
})

describe("isRenderableInlineAtom", () => {
  it("rejects an empty MathJax preview span", () => {
    const p = paragraph('<p><span class="MathJax_Preview" style="color: inherit;"></span></p>')
    expect(isRenderableInlineAtom(p.firstElementChild as HTMLElement)).toBe(false)
  })

  it("accepts element children or text", () => {
    const p = paragraph('<p><span class="a"><img src="x.svg"></span><span class="b">x</span></p>')
    expect(isRenderableInlineAtom(p.children[0] as HTMLElement)).toBe(true)
    expect(isRenderableInlineAtom(p.children[1] as HTMLElement)).toBe(true)
  })
})

describe("sanitizeInlineAtomClone", () => {
  it("strips ids, walk marks, handlers and unsafe URLs but keeps renderer attributes", () => {
    const p = paragraph(
      `<p><span class="katex" id="f1" tabindex="0" onclick="evil()" data-read-frog-walked="w" aria-labelledby="f1-label" style="color:red"><span class="katex-mathml"><math><mi>x</mi></math></span><span class="katex-html"><a href="javascript:alert(1)">x</a><img src="glyph.svg" onerror="evil()"><span class="mord">x</span></span><script>evil()</script></span></p>`,
    )
    const source = p.firstElementChild as HTMLElement
    const before = source.outerHTML
    const clone = sanitizeInlineAtomClone(source)

    expect(source.outerHTML).toBe(before)
    expect(clone).not.toBe(source)
    expect(clone.hasAttribute("id")).toBe(false)
    expect(clone.hasAttribute("tabindex")).toBe(false)
    expect(clone.hasAttribute("onclick")).toBe(false)
    expect(clone.hasAttribute(WALKED_ATTRIBUTE)).toBe(false)
    expect(clone.hasAttribute("aria-labelledby")).toBe(false)
    expect(clone.getAttribute("style")).toBe("color:red")
    expect(clone.querySelector("script")).toBeNull()
    expect(clone.querySelector(".katex-mathml")).toBeNull()
    expect(clone.querySelector("a")?.hasAttribute("href")).toBe(false)
    expect(clone.querySelector("img")?.getAttribute("src")).toBe("glyph.svg")
    expect(clone.querySelector("img")?.hasAttribute("onerror")).toBe(false)
    expect(clone.querySelector(".mord")?.textContent).toBe("x")
    expect(clone.classList.contains(INLINE_ATOM_CLASS)).toBe(true)
    expect(clone.classList.contains("mathjax_ignore")).toBe(true)
    expect(clone.classList.contains("tex2jax_ignore")).toBe(true)
    expect(clone.getAttribute("translate")).toBe("no")
    expect(clone.getAttribute("aria-hidden")).toBe("true")
    expect(clone.getAttribute("dir")).toBe("ltr")
  })

  it("keeps a native MathML clone renderable without its annotations", () => {
    const p = paragraph(ARXIV_P)
    const clone = sanitizeInlineAtomClone(p.querySelector("math") as HTMLElement)
    expect(clone.localName).toBe("math")
    expect(clone.querySelector("annotation")).toBeNull()
    expect(clone.querySelector("mi")?.textContent).toBe("ω")
    expect(clone.getAttribute("alttext")).toBe("\\omega")
    expect(clone.hasAttribute("id")).toBe(false)
  })

  it("drops MathJax scripts and assistive copies and keeps document-level SVG references", () => {
    const p = paragraph(MATHJAX2_P)
    const clone = sanitizeInlineAtomClone(p.querySelector(".MathJax_SVG") as HTMLElement)
    expect(clone.querySelector("script")).toBeNull()
    expect(clone.querySelector(".MJX_Assistive_MathML")).toBeNull()
    expect(clone.querySelector("use")?.getAttribute("xlink:href")).toBe("#MJMATHI-3C4")
    expect(clone.querySelector("svg")).not.toBeNull()
  })

  it("renames locally referenced SVG ids so MathJax v3 SVG clones stay self-contained", () => {
    const p = paragraph(MATHJAX3_SVG_P)
    const clone = sanitizeInlineAtomClone(p.querySelector("mjx-container") as HTMLElement)
    const path = clone.querySelector("path")
    const use = clone.querySelector("use")
    expect(path?.id).toMatch(/^MJX-1-TEX-I-1D70F-rf-atom-\d+$/)
    expect(use?.getAttribute("xlink:href")).toBe(`#${path?.id}`)
    expect(clone.querySelector("mjx-assistive-mml")).toBeNull()
    expect(clone.querySelector("mjx-math, svg")).not.toBeNull()
    // The source keeps its original ids.
    expect(p.querySelector("path")?.id).toBe("MJX-1-TEX-I-1D70F")
  })

  it("keeps Wikipedia image fallbacks and drops the hidden MathML copy's annotation only", () => {
    const p = paragraph(WIKIPEDIA_P)
    const clone = sanitizeInlineAtomClone(p.querySelector(".mwe-math-element") as HTMLElement)
    expect(clone.querySelector("img")?.getAttribute("src")).toContain("wikimedia.org")
    expect(clone.querySelector("annotation")).toBeNull()
    expect(clone.hasAttribute("id")).toBe(false)
  })
})

describe("renderInlineAtomTranslation", () => {
  function extract(markup: string) {
    const p = paragraph(markup)
    return { p, extraction: extractInlineAtomText([p], DEFAULT_CONFIG) }
  }

  it("places clones at the translated token positions, in translation order", () => {
    const { p, extraction } = extract(
      "<p>Let <math><mi>x</mi></math> be smaller than <math><mi>y</mi></math>.</p>",
    )
    expect(extraction.requestText).toBe("Let {{0}} be smaller than {{1}}.")
    const container = document.createElement("span")
    renderInlineAtomTranslation(container, "设 {{1}} 大于 {{0}}。", extraction)

    expect(container.childNodes).toHaveLength(5)
    expect(container.childNodes[0]?.textContent).toBe("设 ")
    const clones = [...container.querySelectorAll("math")]
    expect(clones).toHaveLength(2)
    expect(clones[0]?.textContent).toBe("y")
    expect(clones[1]?.textContent).toBe("x")
    expect(clones[0]).not.toBe(p.querySelectorAll("math")[1])
    expect(clones.every((clone) => clone.classList.contains(INLINE_ATOM_CLASS))).toBe(true)
    expect(container.textContent).toBe("设 y 大于 x。")
    // Source untouched.
    expect(p.querySelectorAll("math")).toHaveLength(2)
  })

  it("renders a duplicated token once and keeps an unknown token as literal text", () => {
    const { extraction } = extract("<p>Let <math><mi>x</mi></math> be.</p>")
    const container = document.createElement("span")
    renderInlineAtomTranslation(container, "设 {{0}} 和 {{0}} 与 {{9}}。", extraction)
    expect(container.querySelectorAll("math")).toHaveLength(1)
    expect(container.textContent).toBe("设 x 和  与 {{9}}。")
  })

  it("appends dropped atoms after the text and warns once", () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {})
    const { extraction } = extract(
      "<p>Let <math><mi>x</mi></math> and <math><mi>y</mi></math> be.</p>",
    )
    const container = document.createElement("span")
    renderInlineAtomTranslation(container, "没有占位符。", extraction)
    expect(container.textContent).toBe("没有占位符。 x y")
    expect(container.querySelectorAll("math")).toHaveLength(2)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it("resolves tokens against the collision offset", () => {
    const { extraction } = extract("<p>Use {{0}} in templates, unlike <math><mi>x</mi></math>.</p>")
    const container = document.createElement("span")
    renderInlineAtomTranslation(container, "模板里用 {{0}}，不像 {{1}}。", extraction)
    expect(container.textContent).toBe("模板里用 {{0}}，不像 x。")
    expect(container.querySelectorAll("math")).toHaveLength(1)
  })

  it("keeps adjacent clones adjacent and honors an existing dir on the atom", () => {
    const { extraction } = extract(
      '<p>Let <math dir="rtl"><mi>x</mi></math><math><mi>y</mi></math> be.</p>',
    )
    const container = document.createElement("span")
    renderInlineAtomTranslation(container, "设 {{0}}{{1}} 为。", extraction)
    const clones = [...container.querySelectorAll("math")]
    expect(clones).toHaveLength(2)
    expect(clones[0]?.nextSibling).toBe(clones[1])
    expect(clones[0]?.getAttribute("dir")).toBe("rtl")
    expect(clones[1]?.getAttribute("dir")).toBe("ltr")
  })

  it("leaves a token-shaped literal from the page alone", () => {
    // `[[0]]` is prose the provider faithfully returned, not a placeholder:
    // the formula belongs at `{{0}}` and the literal must survive verbatim.
    const { extraction } = extract(
      "<p>Reshape to <code>[[0]]</code> before applying <math><mi>x</mi></math>.</p>",
    )
    const container = document.createElement("span")
    renderInlineAtomTranslation(container, "在应用 {{0}} 前重塑为 [[0]]。", extraction)
    expect(container.querySelectorAll("math")).toHaveLength(1)
    expect(container.textContent).toBe("在应用 x 前重塑为 [[0]]。")
  })
})

describe("containsInlineAtomOutsideWrappers", () => {
  it("is true for host atoms and false for clones inside our own wrappers", () => {
    const withAtom = paragraph(ARXIV_P)
    expect(containsInlineAtomOutsideWrappers(withAtom, DEFAULT_CONFIG)).toBe(true)

    const onlyClone = paragraph(
      `<p>Host text<span class="${CONTENT_WRAPPER_CLASS}">译文 <math class="${INLINE_ATOM_CLASS}"><mi>x</mi></math></span></p>`,
    )
    expect(containsInlineAtomOutsideWrappers(onlyClone, DEFAULT_CONFIG)).toBe(false)
  })

  it("ignores atoms that would not render", () => {
    const p = paragraph('<p>Text <span class="MathJax_Preview" style="color: inherit;"></span></p>')
    expect(containsInlineAtomOutsideWrappers(p, DEFAULT_CONFIG)).toBe(false)
  })

  it("is false for containers without atoms", () => {
    const p = paragraph('<p>Tweet text <img alt="😀" src="emoji.png"> more</p>')
    expect(containsInlineAtomOutsideWrappers(p, DEFAULT_CONFIG)).toBe(false)
  })
})
