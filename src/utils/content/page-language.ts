import type { LangCodeISO6391, LangCodeISO6393 } from "@read-frog/definitions"
import type { DetectionSource } from "./language"
import {
  ISO6393_TO_6391,
  LANG_CODE_ISO6393_OPTIONS,
  LOCALE_TO_ISO6393,
} from "@read-frog/definitions"
import { detectLanguageWithSource } from "./language"

export const PAGE_LANGUAGE_TEXT_SAMPLE_LIMIT = 3000

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

const SKIPPED_TEXT_PARENT_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "IFRAME",
  "SVG",
])

const TRADITIONAL_CHINESE_REGIONS = new Set(["hk", "mo", "tw"])

const ISO6393_BY_LOWERCASE = new Map(
  LANG_CODE_ISO6393_OPTIONS.map(code => [code.toLowerCase(), code] as const),
)

const ISO6391_TO_ISO6393 = createISO6391ToISO6393Map()

export type PageLanguageDetectionSource = DetectionSource | "metadata"

export interface PageLanguageDetectionResult {
  detectedCodeOrUnd: LangCodeISO6393 | "und"
  detectionSource: PageLanguageDetectionSource
}

function createISO6391ToISO6393Map() {
  const localeMap = new Map<string, LangCodeISO6393>()

  for (const [iso6393, iso6391] of Object.entries(ISO6393_TO_6391) as Array<[LangCodeISO6393, LangCodeISO6391 | undefined]>) {
    if (iso6391 && !localeMap.has(iso6391.toLowerCase())) {
      localeMap.set(iso6391.toLowerCase(), iso6393)
    }
  }

  for (const [locale, iso6393] of Object.entries(LOCALE_TO_ISO6393) as Array<[LangCodeISO6391, LangCodeISO6393 | undefined]>) {
    if (iso6393) {
      localeMap.set(locale.toLowerCase(), iso6393)
    }
  }

  return localeMap
}

function resolveLanguageToken(token: string): LangCodeISO6393 | null {
  const normalizedToken = token
    .replace(/_/g, "-")
    .replace(/\..*$/, "")
    .trim()

  if (!normalizedToken)
    return null

  const lowercaseToken = normalizedToken.toLowerCase()
  const exactISO6393 = ISO6393_BY_LOWERCASE.get(lowercaseToken)
  if (exactISO6393)
    return exactISO6393

  const parts = lowercaseToken.split("-").filter(Boolean)
  if (parts[0] === "zh") {
    if (parts.includes("yue"))
      return "yue"

    if (parts.includes("hant") || parts.some(part => TRADITIONAL_CHINESE_REGIONS.has(part)))
      return "cmn-Hant"

    return "cmn"
  }

  const exactLocale = ISO6391_TO_ISO6393.get(lowercaseToken)
  if (exactLocale)
    return exactLocale

  const primaryLanguage = parts[0]
  return primaryLanguage ? ISO6391_TO_ISO6393.get(primaryLanguage) ?? null : null
}

export function resolveLanguageCodeFromLocale(value: string | null | undefined): LangCodeISO6393 | null {
  if (!value)
    return null

  const tokens = value.split(/[,;]/)
  for (const token of tokens) {
    const code = resolveLanguageToken(token)
    if (code)
      return code
  }

  return null
}

function getMetaLanguageCandidates(doc: Document): string[] {
  const candidates: string[] = []

  const htmlLang = doc.documentElement?.getAttribute("lang")
  if (htmlLang)
    candidates.push(htmlLang)

  for (const meta of Array.from(doc.querySelectorAll("meta"))) {
    const keys = [
      meta.getAttribute("http-equiv"),
      meta.getAttribute("name"),
      meta.getAttribute("property"),
      meta.getAttribute("itemprop"),
    ].map(value => value?.trim().toLowerCase()).filter((value): value is string => Boolean(value))

    if (keys.some(key => LANGUAGE_META_KEYS.has(key))) {
      const content = meta.getAttribute("content")
      if (content)
        candidates.push(content)
    }
  }

  return candidates
}

function normalizeTextSample(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

function getTextParentElement(node: Node): Element | null {
  const parent = node.parentNode
  return parent?.nodeType === Node.ELEMENT_NODE ? parent as Element : null
}

function collectPageTextSample(root: Node | null | undefined, maxLength = PAGE_LANGUAGE_TEXT_SAMPLE_LIMIT): string {
  if (!root || maxLength <= 0)
    return ""

  const doc = root.nodeType === Node.DOCUMENT_NODE
    ? root as Document
    : root.ownerDocument

  if (!doc?.createTreeWalker)
    return normalizeTextSample(root.textContent ?? "").slice(0, maxLength)

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
      if (remainingLength <= 0)
        break

      sample += `${separator}${text.slice(0, remainingLength)}`
    }
    currentNode = walker.nextNode()
  }

  return sample
}

export async function detectPageLanguageLightweight(doc: Document = document): Promise<PageLanguageDetectionResult> {
  for (const candidate of getMetaLanguageCandidates(doc)) {
    const code = resolveLanguageCodeFromLocale(candidate)
    if (code) {
      return {
        detectedCodeOrUnd: code,
        detectionSource: "metadata",
      }
    }
  }

  const textForDetection = [
    doc.title,
    collectPageTextSample(doc.body),
  ].filter(Boolean).join("\n\n")

  const { code, source } = await detectLanguageWithSource(textForDetection, {
    enableLLM: false,
  })

  return {
    detectedCodeOrUnd: code,
    detectionSource: source,
  }
}
