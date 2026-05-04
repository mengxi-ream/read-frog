import type { LLMProviderTypes } from "@/types/config/provider"
import { APP_NAME } from "@read-frog/definitions"
import { env } from "@/env"

export const DEFAULT_PROVIDER_HEADERS: Partial<Record<LLMProviderTypes, Record<string, string>>> = {
  anthropic: {
    "anthropic-dangerous-direct-browser-access": "true",
  },
  openrouter: {
    "HTTP-Referer": env.WXT_WEBSITE_URL,
    "X-OpenRouter-Title": APP_NAME,
  },
}

function compactStringRecord(record?: Readonly<Record<string, unknown>>): Record<string, string> | undefined {
  if (!record) {
    return undefined
  }

  const compacted = Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string] => {
      const [, value] = entry
      return typeof value === "string" && value !== ""
    }),
  )

  return Object.keys(compacted).length > 0 ? compacted : undefined
}

export function getDefaultProviderHeaders(provider: LLMProviderTypes): Record<string, string> | undefined {
  return compactStringRecord(DEFAULT_PROVIDER_HEADERS[provider])
}

export function getProviderHeadersWithOverride(
  provider: LLMProviderTypes,
  userHeaders?: Record<string, unknown>,
): Record<string, string> | undefined {
  if (userHeaders !== undefined) {
    return compactStringRecord(userHeaders)
  }

  return getDefaultProviderHeaders(provider)
}
