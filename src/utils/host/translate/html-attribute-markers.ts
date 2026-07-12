export const HTML_ATTRIBUTE_MARKER = "data-rf-attr"

export const HTML_ATTRIBUTE_MARKER_INTEGRITY_ERROR_CODE = "HTML_ATTR_MARKER_INTEGRITY"

export type HtmlAttributeMarkerIntegrityErrorReason =
  | "duplicate-input-marker"
  | "missing-output-marker"
  | "duplicate-output-marker"
  | "unknown-output-marker"
  | "wrong-output-tag"

export interface HtmlAttributeMarker {
  id: string
  tagName: string
}

function getIntegrityErrorMessage(
  reason: HtmlAttributeMarkerIntegrityErrorReason,
  markerId: string,
  expectedTagName?: string,
  actualTagName?: string,
): string {
  switch (reason) {
    case "duplicate-input-marker":
      return `Input contains duplicate HTML attribute marker "${markerId}"`
    case "missing-output-marker":
      return `Translation is missing HTML attribute marker "${markerId}"`
    case "duplicate-output-marker":
      return `Translation contains duplicate HTML attribute marker "${markerId}"`
    case "unknown-output-marker":
      return `Translation contains unknown HTML attribute marker "${markerId}"`
    case "wrong-output-tag":
      return `HTML attribute marker "${markerId}" moved from <${expectedTagName}> to <${actualTagName}>`
    default:
      throw new Error("Unknown HTML attribute marker integrity reason")
  }
}

export class HtmlAttributeMarkerIntegrityError extends Error {
  readonly code = HTML_ATTRIBUTE_MARKER_INTEGRITY_ERROR_CODE

  constructor(
    readonly reason: HtmlAttributeMarkerIntegrityErrorReason,
    readonly markerId: string,
    readonly expectedTagName?: string,
    readonly actualTagName?: string,
  ) {
    super(getIntegrityErrorMessage(reason, markerId, expectedTagName, actualTagName))
    this.name = "HtmlAttributeMarkerIntegrityError"
  }
}

export function isHtmlAttributeMarkerIntegrityError(
  error: unknown,
): error is HtmlAttributeMarkerIntegrityError {
  return (
    error instanceof HtmlAttributeMarkerIntegrityError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === HTML_ATTRIBUTE_MARKER_INTEGRITY_ERROR_CODE)
  )
}

const RAW_TEXT_TAG_NAMES = new Set([
  "iframe",
  "noembed",
  "noframes",
  "noscript",
  "plaintext",
  "script",
  "style",
  "textarea",
  "title",
  "xmp",
])

function isHtmlWhitespace(character: string | undefined): boolean {
  return (
    character === " " ||
    character === "\t" ||
    character === "\n" ||
    character === "\r" ||
    character === "\f"
  )
}

function isAsciiLetter(character: string | undefined): boolean {
  if (!character) return false
  const code = character.charCodeAt(0)
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
}

function toAsciiLowerCase(value: string): string {
  let result = ""
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    result += code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : value[index]
  }
  return result
}

function findOpeningTagEnd(html: string, start: number): number {
  let quote: '"' | "'" | undefined

  for (let index = start; index < html.length; index += 1) {
    const character = html[index]
    if (quote) {
      if (character === quote) quote = undefined
      continue
    }

    if (character === '"' || character === "'") {
      quote = character
    } else if (character === ">") {
      return index
    }
  }

  return -1
}

function findRawTextEnd(html: string, lowerHtml: string, tagName: string, start: number): number {
  const closingTagPrefix = `</${tagName}`
  let searchFrom = start

  while (searchFrom < html.length) {
    const closingTagStart = lowerHtml.indexOf(closingTagPrefix, searchFrom)
    if (closingTagStart === -1) return html.length

    const afterTagName = lowerHtml[closingTagStart + closingTagPrefix.length]
    if (isHtmlWhitespace(afterTagName) || afterTagName === ">") {
      const closingTagEnd = html.indexOf(">", closingTagStart + closingTagPrefix.length)
      return closingTagEnd === -1 ? html.length : closingTagEnd + 1
    }

    searchFrom = closingTagStart + closingTagPrefix.length
  }

  return html.length
}

function parseMarkerAttributes(
  html: string,
  attributesStart: number,
  tagEnd: number,
  tagName: string,
): HtmlAttributeMarker[] {
  const markers: HtmlAttributeMarker[] = []
  let index = attributesStart

  while (index < tagEnd) {
    while (isHtmlWhitespace(html[index])) index += 1
    if (index >= tagEnd || html[index] === "/") break

    const attributeNameStart = index
    while (
      index < tagEnd &&
      !isHtmlWhitespace(html[index]) &&
      html[index] !== "/" &&
      html[index] !== "=" &&
      html[index] !== ">"
    ) {
      index += 1
    }

    if (attributeNameStart === index) {
      index += 1
      continue
    }

    const attributeName = toAsciiLowerCase(html.slice(attributeNameStart, index))
    while (isHtmlWhitespace(html[index])) index += 1

    if (html[index] !== "=") {
      if (attributeName === HTML_ATTRIBUTE_MARKER) {
        markers.push({ id: "", tagName })
      }
      continue
    }

    index += 1
    while (isHtmlWhitespace(html[index])) index += 1

    let value: string
    const quote = html[index]
    if (quote === '"' || quote === "'") {
      const valueStart = ++index
      while (index < tagEnd && html[index] !== quote) index += 1
      if (index >= tagEnd) return markers
      value = html.slice(valueStart, index)
      index += 1
    } else {
      const valueStart = index
      while (index < tagEnd && !isHtmlWhitespace(html[index]) && html[index] !== ">") {
        index += 1
      }
      value = html.slice(valueStart, index)
    }

    if (attributeName === HTML_ATTRIBUTE_MARKER) {
      markers.push({ id: value, tagName })
    }
  }

  return markers
}

/**
 * Extract protected-attribute markers without relying on DOM globals, which are
 * unavailable in a Manifest V3 background service worker.
 */
export function parseHtmlAttributeMarkers(html: string): HtmlAttributeMarker[] {
  const markers: HtmlAttributeMarker[] = []
  const lowerHtml = toAsciiLowerCase(html)
  let index = 0

  while (index < html.length) {
    const tagStart = html.indexOf("<", index)
    if (tagStart === -1) break

    if (html.startsWith("<!--", tagStart)) {
      const commentEnd = html.indexOf("-->", tagStart + 4)
      index = commentEnd === -1 ? html.length : commentEnd + 3
      continue
    }

    if (html[tagStart + 1] === "!" || html[tagStart + 1] === "?") {
      const declarationEnd = findOpeningTagEnd(html, tagStart + 2)
      index = declarationEnd === -1 ? html.length : declarationEnd + 1
      continue
    }

    const tagNameStart = tagStart + 1
    if (!isAsciiLetter(html[tagNameStart])) {
      index = tagNameStart
      continue
    }

    let tagNameEnd = tagNameStart + 1
    while (
      tagNameEnd < html.length &&
      !isHtmlWhitespace(html[tagNameEnd]) &&
      html[tagNameEnd] !== "/" &&
      html[tagNameEnd] !== ">"
    ) {
      tagNameEnd += 1
    }

    const tagEnd = findOpeningTagEnd(html, tagNameEnd)
    if (tagEnd === -1) break

    const tagName = toAsciiLowerCase(html.slice(tagNameStart, tagNameEnd))
    markers.push(...parseMarkerAttributes(html, tagNameEnd, tagEnd, tagName))

    index = RAW_TEXT_TAG_NAMES.has(tagName)
      ? findRawTextEnd(html, lowerHtml, tagName, tagEnd + 1)
      : tagEnd + 1
  }

  return markers
}

export function hasHtmlAttributeMarkerProtocol(html: string): boolean {
  const markers = parseHtmlAttributeMarkers(html)
  if (markers.length === 0) return false

  const isCompactMarker = (id: string) => /^(?:0|[1-9]\d*)$/.test(id)
  const isEscapedPageMarker = (id: string) => /^rf-page-(?:0|[1-9]\d*)$/.test(id)
  return (
    markers.every((marker) => isCompactMarker(marker.id)) ||
    markers.every((marker) => isEscapedPageMarker(marker.id))
  )
}

export function assertHtmlAttributeMarkerIntegrity(input: string, output: string): void {
  const inputMarkersById = new Map<string, HtmlAttributeMarker>()
  for (const marker of parseHtmlAttributeMarkers(input)) {
    if (inputMarkersById.has(marker.id)) {
      throw new HtmlAttributeMarkerIntegrityError("duplicate-input-marker", marker.id)
    }
    inputMarkersById.set(marker.id, marker)
  }

  const outputMarkerIds = new Set<string>()
  for (const marker of parseHtmlAttributeMarkers(output)) {
    if (outputMarkerIds.has(marker.id)) {
      throw new HtmlAttributeMarkerIntegrityError("duplicate-output-marker", marker.id)
    }
    outputMarkerIds.add(marker.id)

    const inputMarker = inputMarkersById.get(marker.id)
    if (!inputMarker) {
      throw new HtmlAttributeMarkerIntegrityError("unknown-output-marker", marker.id)
    }
    if (inputMarker.tagName !== marker.tagName) {
      throw new HtmlAttributeMarkerIntegrityError(
        "wrong-output-tag",
        marker.id,
        inputMarker.tagName,
        marker.tagName,
      )
    }
  }

  for (const marker of inputMarkersById.values()) {
    if (!outputMarkerIds.has(marker.id)) {
      throw new HtmlAttributeMarkerIntegrityError("missing-output-marker", marker.id)
    }
  }
}
