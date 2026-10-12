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

/**
 * LaTeXML renders some abstracts as HTML inside fixed-size SVG foreignObjects.
 * Reflow those text-only cards as HTML while translating: entering SVG directly
 * would either clip bilingual text or overlap the next section. Keep the actual
 * source nodes (including links, IDs and listeners) for exact restoration.
 */
export function prepareLatexmlTextBoxes(root: HTMLElement, config: Config): void {
  if (
    !/^(?:arxiv\.org|browse\.arxiv\.org|ar5iv\.labs\.arxiv\.org)$/.test(window.location.hostname)
  ) {
    return
  }
  if (getEffectiveSiteRule(config, window.location.href).dontWalkTagsExplicitAdds?.has("svg"))
    return

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
    const background = svg.querySelector("path")
    const wrapper = svg.ownerDocument.createElement("div")
    wrapper.setAttribute(TEXT_BOX_ATTRIBUTE, "")
    wrapper.style.display = "block"
    wrapper.style.boxSizing = "border-box"
    wrapper.style.width = svgStyle.width
    wrapper.style.maxWidth = "100%"
    wrapper.style.padding = "1.5em"
    wrapper.style.borderRadius = "0.75em"
    wrapper.style.fontSize = contentStyle.fontSize
    if (background) {
      const fill = window.getComputedStyle(background).fill
      if (fill && fill !== "none") wrapper.style.backgroundColor = fill
    }

    // Store the original SVG in an inert template, rather than only JS state,
    // so cleanup still works after a content-script/extension reload.
    const original = svg.ownerDocument.createElement("template")
    original.setAttribute(ORIGINAL_ATTRIBUTE, "")
    parent.replaceChild(wrapper, svg)
    original.content.append(svg)
    wrapper.append(content, original)
  }
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
      originalParent.append(content)
      wrapper.replaceWith(svg)
    }
  }
}
