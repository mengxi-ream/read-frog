import type { Config } from "@/types/config/config"
import { isLLMProvider } from "@/types/config/provider"
import { resolveProviderConfig } from "@/utils/constants/feature-providers"
import { sendMessage } from "@/utils/message"

const KNOWN_WORDS_TTL_MS = 30_000
let knownWordsCache: { words: Set<string>; fetchedAt: number } | null = null

export async function getKnownWords(): Promise<ReadonlySet<string>> {
  const now = Date.now()
  if (knownWordsCache && now - knownWordsCache.fetchedAt < KNOWN_WORDS_TTL_MS) {
    return knownWordsCache.words
  }
  const words = await sendMessage("vocabularyGetKnownWords")
  knownWordsCache = { words: new Set(words), fetchedAt: now }
  return knownWordsCache.words
}

/**
 * Glosses need an LLM. Use the translate provider when it is one; otherwise
 * prefer an enabled LLM provider the user actually configured (has an API
 * key) — several keyless LLM providers ship enabled by default and would
 * otherwise be picked first and fail every request.
 */
export function resolveVocabularyProviderId(config: Config): string | undefined {
  const translateProvider = resolveProviderConfig(config, "translate")
  if (translateProvider.enabled && isLLMProvider(translateProvider.provider)) {
    return translateProvider.id
  }
  const llmProviders = config.providersConfig.filter(
    (provider) => provider.enabled && isLLMProvider(provider.provider),
  )
  const configured = llmProviders.find((provider) => "apiKey" in provider && provider.apiKey)
  return (configured ?? llmProviders[0])?.id
}

export async function fetchGlosses(
  words: string[],
  config: Config,
  providerId: string,
): Promise<Map<string, string>> {
  const record = await sendMessage("vocabularyGetGlosses", {
    words,
    targetLangCode: config.language.targetCode,
    providerId,
  })
  return new Map(Object.entries(record))
}
