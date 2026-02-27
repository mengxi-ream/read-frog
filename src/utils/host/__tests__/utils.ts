import type { TranslationMode } from "@/types/config/translate"
import { expect } from "vitest"
import { CONTENT_WRAPPER_CLASS, NOTRANSLATE_CLASS, TRANSLATION_MODE_ATTRIBUTE } from "@/utils/constants/dom-labels"

export const MOCK_TRANSLATION = "translation"
export const MOCK_ORIGINAL_TEXT = "原文"

export function expectTranslationWrapper(node: Element, mode: TranslationMode) {
  const wrapper = node.querySelector(`.${CONTENT_WRAPPER_CLASS}`)
  expect(wrapper).toBeTruthy()
  expect(wrapper).toHaveAttribute(TRANSLATION_MODE_ATTRIBUTE, mode)
  expect(wrapper).toHaveClass(NOTRANSLATE_CLASS)
  return wrapper
}

export function expectTranslatedContent(wrapper: Element | null, contentClass: string, text: string = MOCK_TRANSLATION) {
  const content = wrapper?.querySelector(`.${contentClass}`)
  expect(content).toBeTruthy()
  expect(content).toHaveTextContent(text)
  expect(content).toHaveClass(NOTRANSLATE_CLASS)
  return content
}

export function expectNodeLabels(node: Element, attributes: string[]) {
  attributes.forEach((attr) => {
    expect(node).toHaveAttribute(attr)
  })
}
