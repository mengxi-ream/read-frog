import type { TransNode } from "@/types/dom"
import { MARK_ATTRIBUTES, NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"
import { isMathRootElement } from "@/utils/constants/dom-rules"
import {
  assertHtmlAttributeMarkerIntegrity,
  HTML_ATTRIBUTE_MARKER,
  HtmlAttributeMarkerIntegrityError,
} from "../html-attribute-markers"

export const TRANSLATABLE_ATTRIBUTE_NAMES = new Set([
  "abbr",
  "alt",
  "aria-description",
  "aria-label",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "label",
  "placeholder",
  "title",
])

export const TRANSLATABLE_INPUT_VALUE_TYPES = new Set(["button", "reset", "submit"])
const SHOW_COMMENT = 128
const ELEMENT_NODE = 1

interface AttributeSnapshot {
  attribute: Attr
  localName: string
  name: string
  namespaceURI: string | null
  value: string
}

interface ElementAttributeSnapshot {
  attributes: AttributeSnapshot[]
  preservedChildren?: ChildNode[]
  tagName: string
  translatableAttributes: AttributeSnapshot[]
  translatableAttributeNames: Set<string>
}

interface LegacyMarkerSnapshot {
  attributes?: AttributeSnapshot[]
  preservedChildren?: ChildNode[]
  value: string | null
}

export interface ProtectedTranslationHtml {
  comparisonSourceHtml: string
  hasPlaceholders: boolean
  legacyRequestHtml: string
  normalizeForComparison: (html: string) => string
  requestHtml: string
  restore: (translatedHtml: string) => string
  restoreLegacy: (translatedHtml: string) => string
  sourceHtml: string
}

function isTranslatableAttribute(element: Element, attributeName: string): boolean {
  const normalizedName = attributeName.toLowerCase()
  if (TRANSLATABLE_ATTRIBUTE_NAMES.has(normalizedName)) return true

  if (normalizedName !== "value" || element.localName.toLowerCase() !== "input") {
    return false
  }

  const inputType = (element.getAttribute("type") ?? "text").toLowerCase()
  return TRANSLATABLE_INPUT_VALUE_TYPES.has(inputType)
}

function removeAttribute(element: Element, attribute: AttributeSnapshot): void {
  if (attribute.namespaceURI) {
    element.removeAttributeNS(attribute.namespaceURI, attribute.localName)
  } else {
    element.removeAttribute(attribute.name)
  }
}

function restoreAttribute(element: Element, attribute: AttributeSnapshot): void {
  const clonedAttribute = attribute.attribute.cloneNode() as Attr
  if (clonedAttribute.namespaceURI) {
    element.setAttributeNodeNS(clonedAttribute)
  } else {
    // setAttribute rejects parser-valid framework syntax such as `@click`.
    // Reattaching a cloned Attr preserves those names without reparsing them.
    element.setAttributeNode(clonedAttribute)
  }
}

function getAllElements(root: DocumentFragment | Element): Element[] {
  const elements: Element[] = []

  for (const child of root.childNodes) {
    if (child.nodeType !== ELEMENT_NODE) continue
    const element = child as Element
    elements.push(element)

    if (element.localName === "template" && "content" in element) {
      elements.push(...getAllElements((element as HTMLTemplateElement).content))
    } else {
      elements.push(...getAllElements(element))
    }
  }

  return elements
}

function getElementsWithAttribute(
  root: DocumentFragment | Element,
  attributeName: string,
): Element[] {
  return getAllElements(root).filter((element) => element.hasAttribute(attributeName))
}

function closestMathRoot(element: Element): Element | null {
  let current: Element | null = element
  while (current) {
    if (isMathRootElement(current)) return current
    current = current.parentElement
  }
  return null
}

function cloneChildNodes(element: Element): ChildNode[] {
  return [...element.childNodes].map((child) => child.cloneNode(true) as ChildNode)
}

function restorePreservedElement(
  element: Element,
  attributes: readonly AttributeSnapshot[],
  children: readonly ChildNode[],
): void {
  for (const attribute of [...element.attributes]) element.removeAttributeNode(attribute)
  attributes.forEach((attribute) => restoreAttribute(element, attribute))
  element.replaceChildren(...children.map((child) => child.cloneNode(true)))
}

function isInsidePreservedRoot(element: Element, roots: ReadonlySet<Element>): boolean {
  let current: Element | null = element
  while (current) {
    if (roots.has(current)) return true
    current = current.parentElement
  }
  return false
}

function normalizeHtmlForComparison(html: string, ownerDoc: Document): string {
  const template = ownerDoc.createElement("template")
  template.innerHTML = html

  getAllElements(template.content).forEach((element) => {
    const attributes = Array.from(element.attributes).sort((left, right) => {
      const leftKey = `${left.namespaceURI ?? ""}:${left.name}`
      const rightKey = `${right.namespaceURI ?? ""}:${right.name}`
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
    })
    attributes.forEach((attribute) => element.removeAttributeNode(attribute))
    attributes.forEach((attribute) => {
      if (attribute.namespaceURI) {
        element.setAttributeNodeNS(attribute)
      } else {
        element.setAttributeNode(attribute)
      }
    })
  })

  return template.innerHTML
}

function replaceCommentsWithSpaces(root: DocumentFragment, ownerDoc: Document): void {
  const walker = ownerDoc.createTreeWalker(root, SHOW_COMMENT)
  const comments: Comment[] = []
  let currentNode = walker.nextNode()

  while (currentNode) {
    comments.push(currentNode as Comment)
    currentNode = walker.nextNode()
  }

  comments.forEach((comment) => comment.replaceWith(ownerDoc.createTextNode(" ")))

  root.querySelectorAll("template").forEach((element) => {
    if ("content" in element) {
      replaceCommentsWithSpaces(element.content, ownerDoc)
    }
  })
}

function serializeTextNode(node: Text, ownerDoc: Document): string {
  const encoder = ownerDoc.createElement("div")
  encoder.textContent = node.textContent
  return encoder.innerHTML
}

function cloneAndCleanNodes(nodes: readonly TransNode[], ownerDoc: Document): HTMLTemplateElement {
  const template = ownerDoc.createElement("template")
  template.innerHTML = nodes
    .map((node) =>
      node.nodeType === Node.TEXT_NODE
        ? serializeTextNode(node as Text, ownerDoc)
        : (node as HTMLElement).outerHTML,
    )
    .join("")

  // Template contents are inert: parsing custom elements here does not run
  // their constructors or lifecycle callbacks.
  replaceCommentsWithSpaces(template.content, ownerDoc)
  getAllElements(template.content).forEach((element) => {
    MARK_ATTRIBUTES.forEach((attributeName) => element.removeAttribute(attributeName))
  })

  return template
}

function snapshotAttribute(attribute: Attr): AttributeSnapshot {
  return {
    attribute: attribute.cloneNode() as Attr,
    localName: attribute.localName,
    name: attribute.name,
    namespaceURI: attribute.namespaceURI,
    value: attribute.value,
  }
}

function stripUnexpectedAttributes(
  element: Element,
  allowedTranslatableAttributes?: ReadonlySet<string>,
): void {
  Array.from(element.attributes).forEach((attribute) => {
    const normalizedName = attribute.name.toLowerCase()
    const shouldKeep = allowedTranslatableAttributes
      ? allowedTranslatableAttributes.has(normalizedName)
      : isTranslatableAttribute(element, normalizedName)

    if (!shouldKeep) {
      element.removeAttributeNode(attribute)
    }
  })
}

export function protectTranslationHtmlAttributes(
  nodes: readonly TransNode[],
  ownerDoc: Document,
): ProtectedTranslationHtml {
  const container = cloneAndCleanNodes(nodes, ownerDoc)
  const sourceHtml = container.innerHTML
  const comparisonSourceHtml = normalizeHtmlForComparison(sourceHtml, ownerDoc)
  const snapshots = new Map<string, ElementAttributeSnapshot>()
  const legacyContainer = ownerDoc.createElement("template")
  legacyContainer.innerHTML = sourceHtml
  const legacyMarkerSnapshots = new Map<string, LegacyMarkerSnapshot>()

  getAllElements(legacyContainer.content).forEach((element) => {
    const mathRoot = closestMathRoot(element)
    if (mathRoot && mathRoot !== element) {
      // The root snapshot restores this subtree wholesale. Nested page-owned
      // marker attributes must not accidentally join our integrity protocol.
      element.removeAttribute(HTML_ATTRIBUTE_MARKER)
      return
    }
    if (!element.hasAttribute(HTML_ATTRIBUTE_MARKER) && !isMathRootElement(element)) return

    const markerId = `rf-page-${legacyMarkerSnapshots.size}`
    const preserveMath = isMathRootElement(element)
    legacyMarkerSnapshots.set(markerId, {
      value: element.getAttribute(HTML_ATTRIBUTE_MARKER),
      ...(preserveMath
        ? {
            attributes: [...element.attributes].map(snapshotAttribute),
            preservedChildren: cloneChildNodes(element),
          }
        : {}),
    })
    element.setAttribute(HTML_ATTRIBUTE_MARKER, markerId)
    if (preserveMath) {
      element.classList.add(NOTRANSLATE_CLASS)
      element.setAttribute("translate", "no")
    }
  })
  const legacyRequestHtml = legacyContainer.innerHTML

  getAllElements(container.content).forEach((element) => {
    const mathRoot = closestMathRoot(element)
    if (mathRoot && mathRoot !== element) {
      // Only the MathML root participates in the marker protocol; its exact
      // children are restored from the snapshot after translation.
      element.removeAttribute(HTML_ATTRIBUTE_MARKER)
      return
    }

    const preserveMath = isMathRootElement(element)
    const attributes = Array.from(element.attributes)
    const translatableAttributes = preserveMath
      ? []
      : attributes
          .filter((attribute) => isTranslatableAttribute(element, attribute.name))
          .map(snapshotAttribute)
    const translatableAttributeNames = new Set(
      translatableAttributes.map((attribute) => attribute.name.toLowerCase()),
    )
    const protectedAttributes = attributes
      .filter((attribute) => !translatableAttributeNames.has(attribute.name.toLowerCase()))
      .map(snapshotAttribute)

    if (protectedAttributes.length === 0 && !preserveMath) return

    const markerId = String(snapshots.size)
    const preserveNotranslateClass = protectedAttributes.some(
      (attribute) =>
        attribute.name.toLowerCase() === "class" &&
        attribute.value.split(/\s+/).includes(NOTRANSLATE_CLASS),
    )
    const preserveTranslateNo = protectedAttributes.some(
      (attribute) =>
        attribute.name.toLowerCase() === "translate" && attribute.value.toLowerCase() === "no",
    )

    protectedAttributes.forEach((attribute) => removeAttribute(element, attribute))
    if (preserveNotranslateClass) {
      element.setAttribute("class", NOTRANSLATE_CLASS)
    }
    if (preserveTranslateNo) {
      element.setAttribute("translate", "no")
    }
    if (preserveMath) {
      element.setAttribute("class", NOTRANSLATE_CLASS)
      element.setAttribute("translate", "no")
    }
    element.setAttribute(HTML_ATTRIBUTE_MARKER, markerId)

    snapshots.set(markerId, {
      attributes: protectedAttributes,
      preservedChildren: preserveMath ? cloneChildNodes(element) : undefined,
      tagName: element.localName.toLowerCase(),
      translatableAttributes,
      translatableAttributeNames,
    })
  })

  const requestHtml = container.innerHTML

  return {
    comparisonSourceHtml,
    hasPlaceholders: snapshots.size > 0,
    legacyRequestHtml,
    normalizeForComparison: (html) => normalizeHtmlForComparison(html, ownerDoc),
    requestHtml,
    sourceHtml,
    restore(translatedHtml: string): string {
      if (snapshots.size === 0 || translatedHtml === "") return translatedHtml

      assertHtmlAttributeMarkerIntegrity(requestHtml, translatedHtml)

      const template = ownerDoc.createElement("template")
      template.innerHTML = translatedHtml
      const markedElements = getElementsWithAttribute(template.content, HTML_ATTRIBUTE_MARKER)
      const markedElementSet = new Set(markedElements)
      const restoredPreservedRoots = new Set<Element>()
      const restoredIds = new Set<string>()

      for (const element of markedElements) {
        const markerId = element.getAttribute(HTML_ATTRIBUTE_MARKER)
        const snapshot = markerId === null ? undefined : snapshots.get(markerId)
        if (markerId === null || !snapshot) {
          throw new HtmlAttributeMarkerIntegrityError("unknown-output-marker", markerId ?? "")
        }
        if (restoredIds.has(markerId)) {
          throw new HtmlAttributeMarkerIntegrityError("duplicate-output-marker", markerId)
        }
        if (element.localName.toLowerCase() !== snapshot.tagName) {
          throw new HtmlAttributeMarkerIntegrityError(
            "wrong-output-tag",
            markerId,
            snapshot.tagName,
            element.localName.toLowerCase(),
          )
        }

        stripUnexpectedAttributes(element, snapshot.translatableAttributeNames)
        snapshot.attributes.forEach((attribute) => restoreAttribute(element, attribute))
        snapshot.translatableAttributes.forEach((attribute) => {
          const hasTranslatedAttribute = attribute.namespaceURI
            ? element.hasAttributeNS(attribute.namespaceURI, attribute.localName)
            : element.hasAttribute(attribute.name)
          if (!hasTranslatedAttribute) restoreAttribute(element, attribute)
        })
        if (snapshot.preservedChildren) {
          element.replaceChildren(
            ...snapshot.preservedChildren.map((child) => child.cloneNode(true)),
          )
          restoredPreservedRoots.add(element)
        }
        restoredIds.add(markerId)
      }

      if (restoredIds.size !== snapshots.size) {
        const missingMarkerId = [...snapshots.keys()].find((id) => !restoredIds.has(id)) ?? ""
        throw new HtmlAttributeMarkerIntegrityError("missing-output-marker", missingMarkerId)
      }

      getAllElements(template.content).forEach((element) => {
        if (
          !markedElementSet.has(element) &&
          !isInsidePreservedRoot(element, restoredPreservedRoots)
        ) {
          stripUnexpectedAttributes(element)
        }
      })

      return template.innerHTML
    },
    restoreLegacy(translatedHtml: string): string {
      if (translatedHtml === "") return translatedHtml

      const template = ownerDoc.createElement("template")
      template.innerHTML = translatedHtml

      if (legacyMarkerSnapshots.size === 0) {
        getElementsWithAttribute(template.content, HTML_ATTRIBUTE_MARKER).forEach((element) =>
          element.removeAttribute(HTML_ATTRIBUTE_MARKER),
        )
        return template.innerHTML
      }

      assertHtmlAttributeMarkerIntegrity(legacyRequestHtml, translatedHtml)
      getElementsWithAttribute(template.content, HTML_ATTRIBUTE_MARKER).forEach((element) => {
        const markerId = element.getAttribute(HTML_ATTRIBUTE_MARKER)
        const snapshot = markerId === null ? undefined : legacyMarkerSnapshots.get(markerId)
        if (!snapshot) {
          throw new HtmlAttributeMarkerIntegrityError("unknown-output-marker", markerId ?? "")
        }
        if (snapshot.attributes && snapshot.preservedChildren) {
          restorePreservedElement(element, snapshot.attributes, snapshot.preservedChildren)
        } else if (snapshot.value === null) {
          element.removeAttribute(HTML_ATTRIBUTE_MARKER)
        } else {
          element.setAttribute(HTML_ATTRIBUTE_MARKER, snapshot.value)
        }
      })

      return template.innerHTML
    },
  }
}
