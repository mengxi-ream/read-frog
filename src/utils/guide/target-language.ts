import type { LanguageTag } from "@read-frog/definitions"
import { languageTagSchema, resolveLanguage } from "@read-frog/definitions"

/**
 * The guide page may omit or mistype the language; only a listed language may
 * reach the config. The old literal "eng" fallback silently overwrote the
 * user's configured target language on every onboarding visit.
 *
 * Newer guide pages send a BCP 47 `languageTag`; older ones send only the
 * ISO 639-3 `langCodeISO6393`, which still resolves.
 */
export function resolveGuideTargetLanguage(data: unknown): LanguageTag | null {
  if (typeof data !== "object" || data === null) return null
  const { languageTag, langCodeISO6393 } = data as {
    languageTag?: unknown
    langCodeISO6393?: unknown
  }
  const tag = languageTagSchema.safeParse(languageTag)
  if (tag.success) return tag.data
  return typeof langCodeISO6393 === "string" ? resolveLanguage(langCodeISO6393) : null
}

/**
 * The answer to the guide page's `getTargetLanguage`. `languageTag` tells the
 * guide this build keys languages by tag, so it may offer European Portuguese,
 * which builds from before tags would take as Brazilian. Guide pages from
 * before tags read `targetLanguage`.
 */
export function getGuideTargetLanguageAnswer(targetCode: LanguageTag) {
  return { targetLanguage: targetCode, languageTag: targetCode }
}
