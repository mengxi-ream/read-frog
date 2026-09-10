import { z } from "zod"
import { DEFAULT_GLOSSARY_CONFIG } from "@/utils/constants/glossary"

/**
 * Only the SETTINGS live in config. The terms themselves live in Dexie
 * (`utils/db/dexie/tables/glossary-term.ts`) because the whole config is one
 * storage key that `getLocalConfig()` re-parses on every translation batch —
 * 20,000 terms in here would cost ~1.9 ms of `JSON.parse` per batch and ~3.5 ms
 * of `JSON.stringify` on every unrelated settings write.
 *
 * `.default()` mirrors `uiLanguageSchema` / `translationHubSchema`: it lets a
 * config stored before this field existed still parse in UI contexts that load
 * ahead of the background migration, instead of falling back to DEFAULT_CONFIG
 * and writing that over the user's settings.
 */
export const glossaryConfigSchema = z
  .object({
    enabled: z.boolean(),
  })
  .default(DEFAULT_GLOSSARY_CONFIG)

export type GlossaryConfig = z.infer<typeof glossaryConfigSchema>
