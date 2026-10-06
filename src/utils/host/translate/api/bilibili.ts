import type { TranslationTextFormat } from "@/types/config/translate"
import { browser } from "#imports"
import { attachRequestErrorMeta } from "@/utils/request/retry-policy"

const ENDPOINT = "https://index-translate.bilibili.com/v1/chat/completions"
const ORIGIN_RULE_ID = 2309
const MAX_PROMPT_LENGTH = 4096
let originRuleReady: Promise<void> | undefined

function ensureOriginRule(): Promise<void> {
  // Await installation before the first fetch, including after a worker restart.
  // runtime.id is not Firefox's moz-extension host; getURL works in both browsers.
  originRuleReady ??= browser.declarativeNetRequest
    .updateDynamicRules({
      removeRuleIds: [ORIGIN_RULE_ID],
      addRules: [
        {
          id: ORIGIN_RULE_ID,
          priority: 1,
          action: {
            type: "modifyHeaders",
            requestHeaders: [{ header: "Origin", operation: "remove" }],
          },
          condition: {
            urlFilter: `|${ENDPOINT}|`,
            initiatorDomains: [new URL(browser.runtime.getURL("")).host],
            resourceTypes: ["xmlhttprequest"],
          },
        },
      ],
    })
    .catch((error) => {
      originRuleReady = undefined
      throw error
    })
  return originRuleReady
}

/** Keep the entire prompt under the gateway limit, preferably splitting at word boundaries. */
function splitText(text: string, maxLength: number): string[] {
  const chunks: string[] = []
  while (text.length > maxLength) {
    let end = maxLength
    const prefix = text.slice(0, end)
    const boundaries = [...prefix.matchAll(/[\s。！？.!?]/gu)]
    const boundary = boundaries.at(-1)
    if (boundary && boundary.index >= maxLength / 2) {
      end = boundary.index + boundary[0].length
    } else if (/[\uD800-\uDBFF]/u.test(text[end - 1]!)) {
      end--
    }
    chunks.push(text.slice(0, end))
    text = text.slice(end)
  }
  if (text) chunks.push(text)
  return chunks
}

export async function bilibiliTranslate(
  source: string,
  fromLang: string,
  toLang: string,
  options?: { textFormat?: TranslationTextFormat; signal?: AbortSignal },
): Promise<string> {
  if (options?.textFormat === "html") {
    throw new Error("Bilibili Index Translate does not support HTML fragments")
  }
  if (!source.trim()) return source
  options?.signal?.throwIfAborted()
  // Match the upstream model's canonical translation prompt. Language names also
  // cover languages without an ISO 639-1 code (unlike the other free adapters).
  const prompt = `请将以下${fromLang === "auto" ? "" : fromLang}文本翻译为${toLang}，直接输出翻译结果，不要进行任何解释。\n\n`
  const maxTextLength = MAX_PROMPT_LENGTH - prompt.length
  if (maxTextLength <= 0) throw new Error("Bilibili translation language name is too long")
  await ensureOriginRule()

  const translations: string[] = []
  // Sequential requests keep a single long paragraph from flooding the free API.
  for (const chunk of splitText(source, maxTextLength)) {
    options?.signal?.throwIfAborted()
    const leading = chunk.match(/^\s*/u)![0]
    const trailing = chunk.match(/\s*$/u)![0]
    if (!chunk.trim()) {
      translations.push(chunk)
      continue
    }
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({
        model: "Index-Translate-35B-A3B",
        messages: [{ role: "user", content: prompt + chunk.trim() }],
        temperature: 0,
        max_tokens: 4096,
        stream: false,
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal: options?.signal,
    }).catch((error) => {
      options?.signal?.throwIfAborted()
      throw attachRequestErrorMeta(
        new Error("Network error during Bilibili translation", { cause: error }),
        {
          kind: "network",
          isRetryable: true,
        },
      )
    })
    if (!response.ok) {
      throw attachRequestErrorMeta(
        new Error(`Bilibili translation request failed: ${response.status} ${response.statusText}`),
        {
          statusCode: response.status,
          responseHeaders: response.headers,
        },
      )
    }
    const result = await response.json()
    const choice = result?.choices?.[0]
    if (choice?.finish_reason === "length") {
      throw new Error("Bilibili translation was truncated")
    }
    const content = choice?.message?.content
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Bilibili translation returned an empty or invalid response")
    }
    translations.push(leading + content.trim() + trailing)
  }
  return translations.join("")
}
