import type { VocabularyDictionary } from "./storage"
import { backgroundFetch } from "@/utils/content-script/background-fetch-client"

export interface EmbeddedDictionaryResult {
  title: string
  text: string
  suggestions?: Array<{ word: string; description: string }>
  entry?: {
    word: string
    level?: string
    phonetics: Array<{ region: string; value: string }>
    meanings: Array<{ partOfSpeech: string; definition: string }>
    forms?: string
    details?: string
  }
}

const cache = new Map<string, EmbeddedDictionaryResult>()

const DICTIONARIES: Record<
  Exclude<VocabularyDictionary, "ai">,
  { title: string; url: (word: string) => string; selectors: string[] }
> = {
  haici: {
    title: "海词词典",
    url: (word) => `https://dict.cn/search?q=${encodeURIComponent(word)}`,
    selectors: [".main"],
  },
  collins: {
    title: "Collins",
    url: (word) =>
      `https://www.collinsdictionary.com/dictionary/english/${encodeURIComponent(word)}`,
    selectors: ["#main_content .res_cell_center", "#main_content"],
  },
  longman: {
    title: "Longman",
    url: (word) => `https://www.ldoceonline.com/dictionary/${encodeURIComponent(word)}`,
    selectors: [".responsive_cell6", ".dictionary"],
  },
  google: {
    title: "Google 词典",
    url: (word) =>
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&dt=bd&q=${encodeURIComponent(word)}`,
    selectors: [],
  },
}

function parseGoogleDictionary(payload: unknown) {
  if (!Array.isArray(payload)) return ""
  const translations = Array.isArray(payload[0])
    ? payload[0]
        .map((item) => (Array.isArray(item) && typeof item[0] === "string" ? item[0] : ""))
        .filter(Boolean)
    : []
  const dictionaryEntries = Array.isArray(payload[1]) ? payload[1] : []
  const sections = dictionaryEntries.flatMap((entry) => {
    if (!Array.isArray(entry)) return []
    const partOfSpeech = typeof entry[0] === "string" ? entry[0] : ""
    const meanings = Array.isArray(entry[1])
      ? entry[1].filter((item): item is string => typeof item === "string")
      : []
    return meanings.length ? [`${partOfSpeech || "释义"}\n${meanings.join("；")}`] : []
  })
  return [translations.length ? `中文翻译\n${translations.join("；")}` : "", ...sections]
    .filter(Boolean)
    .join("\n\n")
}

function restoreGoogleFragments(document: Document, html: string) {
  const matcher = /\(function\(\)\{window\.jsl\.dh\('([^']+)','([^']+)'\);\}\)\(\);/g
  let match: RegExpExecArray | null
  while ((match = matcher.exec(html))) {
    const element = document.getElementById(match[1])
    if (!element) continue
    element.innerHTML = match[2]
      .replace(/\\x([\da-f]{2})/gi, (_value, code: string) =>
        String.fromCharCode(Number.parseInt(code, 16)),
      )
      .replace(/\\u([\da-f]{4})/gi, (_value, code: string) =>
        String.fromCharCode(Number.parseInt(code, 16)),
      )
  }
}

function cleanText(
  root: Element,
  dictionary: Exclude<VocabularyDictionary, "ai">,
  maximumLength = 9000,
) {
  root
    .querySelectorAll(
      [
        "script",
        "style",
        "form",
        "nav",
        "header",
        "footer",
        "iframe",
        "svg",
        ".ad",
        ".ads",
        ".advertisement",
        ".sidenav",
        ".copyright",
        ".auth",
        ".lr_dct_trns_h",
        ".S5TwIf",
        ".VZVCid",
        ".u7XA4b",
        "[jsname='L4Nn5e']",
      ].join(","),
    )
    .forEach((element) => element.remove())

  const rawLines = (root.textContent ?? "")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line, index, all) => index === 0 || line !== all[index - 1])

  const lines =
    dictionary === "haici"
      ? rawLines.filter(
          (line) => !["海词词典", "登录", "注册", "意见反馈", "版权声明"].includes(line),
        )
      : rawLines

  return lines.join("\n").slice(0, maximumLength)
}

function parseHaiciEntry(document: Document) {
  const word = document.querySelector(".main h1.keyword")?.textContent?.trim()
  if (!word) return undefined
  const levelElement = document.querySelector<HTMLElement>(".main .level-title")
  const level = levelElement?.getAttribute("level")?.trim() || levelElement?.textContent?.trim()
  const phonetics = [...document.querySelectorAll(".main .phonetic > span")].flatMap((element) => {
    const value = element.querySelector("bdo")?.textContent?.trim()
    if (!value) return []
    const region = (element.childNodes[0]?.textContent ?? "").trim() || "音标"
    return [{ region, value }]
  })
  const meanings = [...document.querySelectorAll(".main .basic li")].flatMap((element) => {
    const partOfSpeech = element.querySelector("span")?.textContent?.trim()
    const definition = element.querySelector("strong")?.textContent?.trim()
    return partOfSpeech && definition ? [{ partOfSpeech, definition }] : []
  })
  const forms = document.querySelector(".main .shape")?.textContent?.replace(/\s+/g, " ").trim()
  const detailsRoot = document.querySelector(".main .section.def")
  const details = detailsRoot
    ? cleanText(detailsRoot.cloneNode(true) as Element, "haici", Number.POSITIVE_INFINITY)
    : undefined
  return { word, level, phonetics, meanings, forms, details }
}

export async function lookupEmbeddedDictionary(
  dictionary: Exclude<VocabularyDictionary, "ai">,
  word: string,
): Promise<EmbeddedDictionaryResult> {
  const cacheKey = `${dictionary}:${word.toLocaleLowerCase()}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const definition = DICTIONARIES[dictionary]
  let response = await backgroundFetch(definition.url(word), undefined, {
    cacheConfig: {
      enabled: true,
      groupKey: "vocabulary-dictionary",
      ttl: 24 * 60 * 60 * 1000,
    },
  })
  if (!response.ok) throw new Error(`${definition.title} 暂时无法查询（${response.status}）`)

  let html = await response.text()
  if (dictionary === "google") {
    let text = ""
    try {
      text = parseGoogleDictionary(JSON.parse(html))
    } catch {
      // A readable error is returned below.
    }
    if (!text) throw new Error("Google 词典没有返回可显示的释义")
    const result = { title: definition.title, text }
    cache.set(cacheKey, result)
    return result
  }

  let document = new DOMParser().parseFromString(html, "text/html")
  restoreGoogleFragments(document, html)
  let root = definition.selectors
    .map((selector) => document.querySelector(selector))
    .find((element): element is Element => Boolean(element))
  const suggestions =
    dictionary === "haici"
      ? [...document.querySelectorAll(".section.unfind li")].flatMap((item) => {
          const anchor = item.querySelector<HTMLAnchorElement>("a[href]")
          const suggestedWord = anchor?.textContent?.trim().toLocaleLowerCase()
          if (!suggestedWord) return []
          const description = (item.textContent ?? "").replace(anchor?.textContent ?? "", "").trim()
          return [{ word: suggestedWord, description }]
        })
      : []
  const entry =
    dictionary === "haici" && !suggestions.length ? parseHaiciEntry(document) : undefined
  const text = suggestions.length
    ? "请选择下面最接近的词条："
    : root
      ? cleanText(root, dictionary)
      : ""
  if (!text) throw new Error(`${definition.title} 没有返回可显示的释义`)

  const result = {
    title: definition.title,
    text,
    suggestions: suggestions.length ? suggestions : undefined,
    entry,
  }
  cache.set(cacheKey, result)
  return result
}
