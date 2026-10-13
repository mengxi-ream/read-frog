import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { TransNode } from "@/types/dom"
import { CONTENT_WRAPPER_CLASS } from "@/utils/constants/dom-labels"
import { resolveLanguageCodeFromLocale } from "@/utils/content/page-language"
import { isHTMLElement } from "../../dom/filter"
import { getTranslationOnlyAnchorState } from "../core/translation-state"

function getSourceLang(element: Element): string | null {
  const adjustment = isHTMLElement(element)
    ? getTranslationOnlyAnchorState(element)?.attributeAdjustments.find(
        ({ name }) => name === "lang",
      )
    : undefined
  // In-place translation temporarily sets the anchor's language to the target.
  // Retranslation and untranslated siblings still need its original declaration.
  return adjustment ? adjustment.previousValue : element.getAttribute("lang")
}

function getLocalDeclaration(element: Element | null | undefined): Element | null {
  for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
    if (getSourceLang(ancestor) !== null) return ancestor
  }
  return null
}

function getNestedDeclarations(node: TransNode): Element[] {
  return isHTMLElement(node)
    ? Array.from(node.querySelectorAll("[lang]")).filter(
        (child) => !child.closest(`.${CONTENT_WRAPPER_CLASS}`) && getSourceLang(child) !== null,
      )
    : []
}

/**
 * Read the paragraph's declared language, including inherited local lang
 * attributes. Never infer a post's language from the document/UI language.
 * Conflicting or unknown declarations keep a mixed run eligible for translation.
 */
export function getDeclaredTranslationLanguage(
  nodes: readonly TransNode[],
): LangCodeISO6393 | "mixed" | null {
  let language: LangCodeISO6393 | null = null
  let hasUndeclaredSource = false
  for (const node of nodes) {
    const element = isHTMLElement(node) ? node : node.parentElement
    const declaration = getLocalDeclaration(element)
    const nestedDeclarations = getNestedDeclarations(node)
    if (
      !declaration ||
      ["HTML", "BODY", "MAIN"].includes(declaration.tagName) ||
      declaration.getAttribute("role") === "main"
    ) {
      if (nestedDeclarations.length > 0) return "mixed"
      hasUndeclaredSource = true
      continue
    }
    const code = resolveLanguageCodeFromLocale(getSourceLang(declaration))
    if (!code || (language !== null && language !== code)) return "mixed"

    if (
      nestedDeclarations.some(
        (child) => resolveLanguageCodeFromLocale(getSourceLang(child)) !== code,
      )
    ) {
      return "mixed"
    }
    language = code
  }
  return language && hasUndeclaredSource ? "mixed" : language
}
