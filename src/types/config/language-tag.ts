import type { LanguageTag } from "@read-frog/definitions"
import { languageTagSchema, resolveLanguage } from "@read-frog/definitions"
import { z } from "zod"

/**
 * A language as config stores it.
 *
 * A config written before languages were keyed by BCP 47 tag holds ISO 639-3
 * codes (`cmn`) until the background's v121 → v122 migration runs. UI contexts
 * can load ahead of it, and a config that fails to parse there falls back to
 * DEFAULT_CONFIG, which the next write then saves over the user's settings.
 * Read as its tag, a code keeps such a config parseable, as the `.default()`s
 * on later fields do (`uiLanguageSchema`, `translationHubSchema`).
 *
 * The input type stays the tag: code writes tags, and only storage holds a
 * code. Forms validate with schemas built on this one and need input and
 * output to agree.
 */
export const storedLanguageTagSchema = z.preprocess<unknown, typeof languageTagSchema, LanguageTag>(
  (value: unknown) => (typeof value === "string" ? (resolveLanguage(value) ?? value) : value),
  languageTagSchema,
)
