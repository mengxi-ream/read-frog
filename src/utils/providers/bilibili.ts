import { browser } from "#imports"

const ENDPOINT = "https://index-translate.bilibili.com/v1/chat/completions"
const ORIGIN_RULE_ID = 2309
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

/** Shared transport for translation, structured actions, suggestions and streaming. */
export const bilibiliFetch: typeof globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input)
  // A user can point a provider at a self-hosted model. Only the official free
  // endpoint needs these gateway settings and an Origin rule.
  if (url !== ENDPOINT) return fetch(input, init)

  init?.signal?.throwIfAborted()
  await ensureOriginRule()
  init?.signal?.throwIfAborted()
  // The AI SDK sends JSON strings. Preserve messages, schemas, stream options and
  // cancellation; splitting them would break structured output and action context.
  const body = JSON.parse(init?.body as string)
  return fetch(input, {
    ...init,
    credentials: "omit",
    body: JSON.stringify({
      ...body,
      max_tokens: Math.min(body.max_tokens ?? 4096, 4096),
      chat_template_kwargs: { ...body.chat_template_kwargs, enable_thinking: false },
    }),
  })
}
