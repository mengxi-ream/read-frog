import type { Config } from "@/types/config/config"
import { getEffectiveSiteRule } from "@/utils/site-rules/effective"
import {
  hasNoWalkAncestor,
  isDontWalkIntoButTranslateAsChildElement,
  isSiteRuleExcludedElement,
  isWithinIncludeScope,
} from "./filter"
import { deepQueryAllSelector } from "./find"

const TEXT_BOX_ATTRIBUTE = "data-read-frog-latexml-text-box"
const ORIGINAL_ATTRIBUTE = "data-read-frog-latexml-original"

// Nodes the reflow itself moves. The page MutationObserver would otherwise
// treat the card as new site content and walk it as a fresh root, which makes
// the box content its own translation unit and translates it a second time.
const reflowedNodes = new WeakSet<Node>()

/** Whether a mutation record only moves nodes of a LaTeXML text box reflow. */
export function isLatexmlTextBoxReflowRecord(record: MutationRecord): boolean {
  if (record.type !== "childList") return false
  const nodes = [...record.addedNodes, ...record.removedNodes]
  return nodes.length > 0 && nodes.every((node) => reflowedNodes.has(node))
}

/**
 * LaTeXML renders some abstracts as HTML inside fixed-size SVG foreignObjects.
 * Reflow those text-only cards as HTML while translating: entering SVG directly
 * would either clip bilingual text or overlap the next section. Keep the actual
 * source nodes (including links, IDs and listeners) for exact restoration.
 * Enabled per site by the `reflowLatexmlTextBoxes` site rule; `svg` itself stays
 * in the dont-walk set, so every other SVG on the page is still skipped.
 */
export function prepareLatexmlTextBoxes(root: HTMLElement, config: Config): void {
  if (getEffectiveSiteRule(config, window.location.href).reflowLatexmlTextBoxes !== true) return

  for (const svg of root.querySelectorAll("svg.ltx_picture")) {
    const objects = svg.querySelectorAll("foreignObject")
    const object = objects[0]
    // Multiple positioned text islands, SVG labels or embedded graphics belong
    // to diagrams. Only adapt a single HTML prose box with a drawn background.
    if (
      objects.length !== 1 ||
      !object ||
      svg.querySelector("text, image, use, svg, rect, circle, ellipse, line, polyline, polygon") ||
      svg.querySelectorAll("path").length > 2
    )
      continue
    const content = object.querySelector<HTMLElement>(".ltx_foreignobject_content")
    if (!content?.querySelector(".ltx_p") || content.querySelector("object, iframe")) continue
    if (
      hasNoWalkAncestor(svg as HTMLElement, config) ||
      isDontWalkIntoButTranslateAsChildElement(svg as HTMLElement, config) ||
      isSiteRuleExcludedElement(svg as HTMLElement, config) ||
      !isWithinIncludeScope(svg as HTMLElement, config) ||
      window.getComputedStyle(svg).display === "none"
    ) {
      continue
    }

    const originalParent = content.parentElement
    const parent = svg.parentElement
    if (
      !parent ||
      !originalParent?.classList.contains("ltx_foreignobject_container") ||
      originalParent.childNodes.length !== 1
    )
      continue
    const svgStyle = window.getComputedStyle(svg)
    const contentStyle = window.getComputedStyle(object)
    const wrapper = svg.ownerDocument.createElement("div")
    wrapper.setAttribute(TEXT_BOX_ATTRIBUTE, "")
    wrapper.style.display = "block"
    wrapper.style.boxSizing = "border-box"
    wrapper.style.width = svgStyle.width
    wrapper.style.maxWidth = "100%"
    wrapper.style.padding = "1.5em"
    wrapper.style.borderRadius = "0.75em"
    wrapper.style.fontSize = contentStyle.fontSize
    applyBoxColors(wrapper, svg)

    // Store the original SVG in an inert template, rather than only JS state,
    // so cleanup still works after a content-script/extension reload.
    const original = svg.ownerDocument.createElement("template")
    original.setAttribute(ORIGINAL_ATTRIBUTE, "")
    for (const node of [wrapper, svg, content, original]) reflowedNodes.add(node)
    parent.replaceChild(wrapper, svg)
    original.content.append(svg)
    wrapper.append(content, original)
  }
}

/**
 * Boxes like tcolorbox draw an outer frame first and an inset interior on top
 * of it. Hand the declared colors to LaTeXML's own theme variables instead of
 * freezing computed ones: the arXiv/ar5iv stylesheet maps `--ltx-bg-color` and
 * `--ltx-border-color` to background and border colors and recomputes them in
 * dark mode, so the card follows theme switches like the rest of the paper. The
 * `var()` fallbacks keep the colors on LaTeXML pages without that stylesheet.
 */
function applyBoxColors(wrapper: HTMLElement, svg: Element): void {
  const paths = svg.querySelectorAll("path")
  const interior = declaredFill(paths[paths.length - 1], svg)
  const frame = paths.length > 1 ? declaredFill(paths[0], svg) : null
  if (interior) {
    wrapper.style.setProperty("--ltx-bg-color", interior)
    wrapper.style.setProperty("background-color", `var(--background-color, ${interior})`)
  }
  if (frame && frame !== interior) {
    wrapper.style.setProperty("--ltx-border-color", frame)
    wrapper.style.setProperty("border", `1px solid var(--border-color, ${frame})`)
  }
}

/** The fill LaTeXML declared on a path, usually inherited from its `<g>`. */
function declaredFill(path: Element | undefined, svg: Element): string | null {
  for (let element = path ?? null; element && element !== svg; element = element.parentElement) {
    const value = (
      (element as SVGElement).style?.getPropertyValue("--ltx-fill-color") ||
      element.getAttribute("fill") ||
      ""
    ).trim()
    if (value) return value === "none" || value.startsWith("url(") ? null : value
  }
  return null
}

export function restoreLatexmlTextBoxes(root: Document | ShadowRoot = document): void {
  for (const wrapper of deepQueryAllSelector(root, (element) =>
    element.hasAttribute(TEXT_BOX_ATTRIBUTE),
  )) {
    const original = wrapper.querySelector<HTMLTemplateElement>(`template[${ORIGINAL_ATTRIBUTE}]`)
    const svg = original?.content.querySelector("svg.ltx_picture")
    const originalParent = svg?.querySelector(".ltx_foreignobject_container")
    const content = wrapper.querySelector<HTMLElement>(".ltx_foreignobject_content")
    if (svg && originalParent && content?.parentElement === wrapper) {
      for (const node of [wrapper, svg, content]) reflowedNodes.add(node)
      originalParent.append(content)
      wrapper.replaceWith(svg)
    }
  }
}
