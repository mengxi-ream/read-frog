import { getDeepActiveElement } from "@/utils/dom/active-element"
import { isDraftElement, replaceDraft } from "./editors/draft-js"
import { isLexicalElement, replaceLexical } from "./editors/lexical"
import { isSlateElement, replaceSlate } from "./editors/slate"

export function replaceText(text: string): boolean {
  const element = getDeepActiveElement()
  if (!element || !(element as HTMLElement).isContentEditable) return false

  if (isLexicalElement(element)) return replaceLexical(element, text)

  if (isSlateElement(element)) return replaceSlate(element, text)

  if (isDraftElement(element)) return replaceDraft(element, text)

  return replaceFallback(element as HTMLElement, text)
}

function replaceFallback(element: HTMLElement, text: string): boolean {
  element.focus()
  document.execCommand("selectAll")
  return document.execCommand("insertText", false, text)
}
