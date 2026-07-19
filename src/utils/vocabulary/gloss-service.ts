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
 * fall back to the first enabled LLM provider.
 */
export function resolveVocabularyProviderId(config: Config): string | undefined {
  const translateProvider = resolveProviderConfig(config, "translate")
  if (translateProvider.enabled && isLLMProvider(translateProvider.provider)) {
    return translateProvider.id
  }
  return config.providersConfig.find(
    (provider) => provider.enabled && isLLMProvider(provider.provider),
  )?.id
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
