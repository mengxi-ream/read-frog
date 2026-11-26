import type { LanguageTag } from "@read-frog/definitions"
import type { DetectionSource } from "./language"
import { resolveLanguage } from "@read-frog/definitions"
import { detectLanguageWithSource } from "./language"

export const PAGE_LANGUAGE_TEXT_SAMPLE_LIMIT = 3000
const MIN_TEXT_LENGTH_FOR_METADATA_VERIFICATION = 80

const SHOW_TEXT = 4
const FILTER_ACCEPT = 1
const FILTER_REJECT = 2

const LANGUAGE_META_KEYS = new Set([
  "content-language",
  "dc.language",
  "dcterms.language",
  "inlanguage",
  "language",
  "og:locale",
])

const SKIPPED_TEXT_PARENT_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "SVG"])

export type PageLanguageDetectionSource = DetectionSource | "metadata"

export interface PageLanguageDetectionResult {
  detectedCodeOrUnd: LanguageTag | "und"
  detectionSource: PageLanguageDetectionSource
}

export function resolveLanguageCodeFromLocale(
  value: string | null | undefined,
): LanguageTag | null {
  if (!value) return null

  // `Content-Language` may list several languages (`en-US, fr`): the first one
  // this list has wins.
  for (const token of value.split(/[,;]/)) {
    const code = resolveLanguage(token)
    if (code) return code
  }

  return null
}

function getMetaLanguageCandidates(doc: Document): string[] {
  const candidates: string[] = []

  const htmlLang = doc.documentElement?.getAttribute("lang")
  if (htmlLang) candidates.push(htmlLang)

  for (const meta of Array.from(doc.querySelectorAll("meta"))) {
    const keys = [
      meta.getAttribute("http-equiv"),
      meta.getAttribute("name"),
      meta.getAttribute("property"),
      meta.getAttribute("itemprop"),
    ]
      .map((value) => value?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value))

    if (keys.some((key) => LANGUAGE_META_KEYS.has(key))) {
      const content = meta.getAttribute("content")
      if (content) candidates.push(content)
    }
  }

  return candidates
}

function normalizeTextSample(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function getTextParentElement(node: Node): Element | null {
  const parent = node.parentNode
  return parent?.nodeType === Node.ELEMENT_NODE ? (parent as Element) : null
}

function collectPageTextSample(
  root: Node | null | undefined,
  maxLength = PAGE_LANGUAGE_TEXT_SAMPLE_LIMIT,
): string {
  if (!root || maxLength <= 0) return ""

  const doc = root.nodeType === Node.DOCUMENT_NODE ? (root as Document) : root.ownerDocument

  if (!doc?.createTreeWalker) return normalizeTextSample(root.textContent ?? "").slice(0, maxLength)

  const walker = doc.createTreeWalker(root, SHOW_TEXT, {
    acceptNode(node) {
      const parentElement = getTextParentElement(node)
      if (!parentElement || SKIPPED_TEXT_PARENT_TAGS.has(parentElement.tagName))
        return FILTER_REJECT

      return normalizeTextSample(node.textContent ?? "") ? FILTER_ACCEPT : FILTER_REJECT
    },
  })

  let sample = ""
  let currentNode = walker.nextNode()
  while (currentNode && sample.length < maxLength) {
    const text = normalizeTextSample(currentNode.textContent ?? "")
    if (text) {
      const separator = sample ? " " : ""
      const remainingLength = maxLength - sample.length - separator.length
      if (remainingLength <= 0) break

      sample += `${separator}${text.slice(0, remainingLength)}`
    }
    currentNode = walker.nextNode()
  }

  return sample
}

// franc tells neither scripts nor regions apart: it reads Traditional Chinese
// as `zh-Hans` and European Portuguese as `pt-BR`. A page's own declaration
// agrees with it when the language matches.
function areCompatibleDetectedCodes(
  metadataCode: LanguageTag,
  textCode: LanguageTag | "und",
): boolean {
  return (
    textCode !== "und" &&
    new Intl.Locale(metadataCode).language === new Intl.Locale(textCode).language
  )
}

export async function detectPageLanguageLightweight(
  doc: Document = document,
): Promise<PageLanguageDetectionResult> {
  let metadataCode: LanguageTag | null = null

  for (const candidate of getMetaLanguageCandidates(doc)) {
    const code = resolveLanguageCodeFromLocale(candidate)
    if (code) {
      metadataCode = code
      break
    }
  }

  const textForDetection = [doc.title, collectPageTextSample(doc.body)].filter(Boolean).join("\n\n")

  if (metadataCode && textForDetection.trim().length < MIN_TEXT_LENGTH_FOR_METADATA_VERIFICATION) {
    return {
      detectedCodeOrUnd: metadataCode,
      detectionSource: "metadata",
    }
  }

  const { code, source } = await detectLanguageWithSource(textForDetection, {
    enableLLM: false,
  })

  if (metadataCode && (code === "und" || areCompatibleDetectedCodes(metadataCode, code))) {
    return {
      detectedCodeOrUnd: metadataCode,
      detectionSource: "metadata",
    }
  }

  return {
    detectedCodeOrUnd: code,
    detectionSource: source,
  }
}
