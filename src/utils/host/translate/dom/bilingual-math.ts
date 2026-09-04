import type { Config } from "@/types/config/config"
import type { TransNode } from "@/types/dom"
import { MARK_ATTRIBUTES, PRESERVED_MATH_CLASS } from "@/utils/constants/dom-labels"
import { isMathRootElement } from "@/utils/constants/dom-rules"
import { extractTextContent } from "../../dom/traversal"

const DEFAULT_MARKER_STEM = "READ_FROG_MATH"
const UNSAFE_CLONED_ATTRIBUTE_NAMES = new Set(["formaction", "href", "src", "xlink:href"])

export interface ProtectedBilingualMath {
  /** Existing prose-only extraction, used for filtering and language detection. */
  filterText: string
  /** Text sent to the provider, with each MathML root replaced by a stable marker. */
  requestText: string
  hasMath: boolean
  renderInto: (container: HTMLElement, translatedText: string) => void
}

function markerStemAbsentFrom(text: string): string {
  let stem = DEFAULT_MARKER_STEM
  while (new RegExp(`\\{\\{\\s*${stem}_\\d+\\s*\\}\\}`, "i").test(text)) stem += "_X"
  return stem
}

function cloneMathForTranslation(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement
  const elements = [clone, ...clone.querySelectorAll<HTMLElement>("*")]

  for (const element of elements) {
    element.removeAttribute("id")
    MARK_ATTRIBUTES.forEach((attribute) => element.removeAttribute(attribute))
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase()
      if (name.startsWith("on") || UNSAFE_CLONED_ATTRIBUTE_NAMES.has(name)) {
        element.removeAttributeNode(attribute)
      }
    }
  }

  clone.classList.add(PRESERVED_MATH_CLASS)
  clone.setAttribute("translate", "no")
  return clone
}

/**
 * Protect MathML in bilingual mode without exposing its internal text to the
 * translation provider. MathML textContent is not a usable fallback: arXiv's
 * accessibility annotation repeats the rendered formula (for example
 * `H0H_{0}`), and translating either copy can corrupt the notation.
 */
export function protectBilingualMath(
  nodes: readonly TransNode[],
  config: Config,
): ProtectedBilingualMath {
  const filterText = nodes.map((node) => extractTextContent(node, config)).join("")
  const markerStem = markerStemAbsentFrom(filterText)
  const mathElements: HTMLElement[] = []
  const mathIndexes = new Map<HTMLElement, number>()

  const requestText = nodes
    .map((node) =>
      extractTextContent(node, config, {
        replaceElement: (element) => {
          if (!isMathRootElement(element)) return undefined

          let index = mathIndexes.get(element)
          if (index === undefined) {
            index = mathElements.length
            mathIndexes.set(element, index)
            mathElements.push(element)
          }
          return `{{${markerStem}_${index}}}`
        },
      }),
    )
    .join("")

  const markerPattern = new RegExp(`\\{\\{\\s*${markerStem}_(\\d+)\\s*\\}\\}`, "gi")

  return {
    filterText,
    requestText,
    hasMath: mathElements.length > 0,
    renderInto(container, translatedText) {
      if (mathElements.length === 0) {
        container.textContent = translatedText
        return
      }

      const ownerDoc = container.ownerDocument
      const fragment = ownerDoc.createDocumentFragment()
      const inserted = new Set<number>()
      let cursor = 0

      for (const match of translatedText.matchAll(markerPattern)) {
        const matchIndex = match.index ?? 0
        if (matchIndex > cursor) {
          fragment.append(ownerDoc.createTextNode(translatedText.slice(cursor, matchIndex)))
        }

        const mathIndex = Number.parseInt(match[1]!, 10)
        const source = mathElements[mathIndex]
        if (source && !inserted.has(mathIndex)) {
          fragment.append(cloneMathForTranslation(source))
          inserted.add(mathIndex)
        } else if (!source) {
          // Do not silently eat a provider-generated token we do not own.
          fragment.append(ownerDoc.createTextNode(match[0]))
        }
        cursor = matchIndex + match[0].length
      }

      if (cursor < translatedText.length) {
        fragment.append(ownerDoc.createTextNode(translatedText.slice(cursor)))
      }

      // The two built-in translators round-trip these markers. If another
      // provider drops one, keep the formula visible at the end rather than
      // reproducing the original silent data loss.
      const missing = mathElements.filter((_, index) => !inserted.has(index))
      for (const source of missing) {
        if (fragment.childNodes.length > 0) fragment.append(ownerDoc.createTextNode(" "))
        fragment.append(cloneMathForTranslation(source))
      }

      container.replaceChildren(fragment)
    },
  }
}
