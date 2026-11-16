import type { BlogLocale } from "@/utils/blog"
import { z } from "zod"
import { storage } from "#imports"
import { createLogger } from "@/utils/logging/logger"
import { orpcClient } from "@/utils/orpc/client"

const log = createLogger("survey-prompt")

const CACHE_KEY = "local:surveyPrompt" as const
const CLICKED_KEY = "local:surveyPromptClicked" as const

/** How long one answer from the server is reused, "no survey" included. */
export const SURVEY_PROMPT_TTL_MS = 6 * 60 * 60 * 1000
/** Surveys come a few a year; the newest twenty clicks are plenty to remember. */
const MAX_CLICKED_KEYS = 20

/** Added to the survey's link, so its answers say they came from here. */
export const SURVEY_PROMPT_SOURCE = "extension_sidebar"

// `closesAtMs`, not the server's Date: storage keeps JSON, and a Date would come
// back as a string.
const surveyPromptSchema = z.object({
  key: z.string(),
  path: z.string(),
  label: z.string(),
  badge: z.string().nullable(),
  closesAtMs: z.number().nullable(),
})

const cacheSchema = z.object({
  locale: z.string(),
  fetchedAt: z.number(),
  prompt: surveyPromptSchema.nullable(),
})

/** The survey the settings page links to from its sidebar. */
export type SurveyPrompt = z.infer<typeof surveyPromptSchema>

async function readCache() {
  const parsed = cacheSchema.safeParse(await storage.getItem(CACHE_KEY))
  return parsed.success ? parsed.data : null
}

/** A survey whose end has passed goes at once, without waiting for the cache to expire. */
function stillOpen(prompt: SurveyPrompt | null, now: number) {
  return prompt && (prompt.closesAtMs === null || prompt.closesAtMs > now) ? prompt : null
}

/**
 * The survey to link to, in the reader's language, or null. Asks the server at
 * most once every six hours per language. A failed request is not stored: the
 * last answer stays in use, and with none the sidebar shows no survey.
 */
export async function getSurveyPrompt(
  locale: BlogLocale,
  now = Date.now(),
): Promise<SurveyPrompt | null> {
  const cached = await readCache()
  const usable = cached?.locale === locale ? cached : null
  const age = usable ? now - usable.fetchedAt : Number.NaN
  // A clock set back makes the age negative; ask again rather than trust it.
  if (usable && age >= 0 && age < SURVEY_PROMPT_TTL_MS) {
    return stillOpen(usable.prompt, now)
  }

  try {
    const result = await orpcClient.survey.prompt({ locale })
    const prompt: SurveyPrompt | null = result && {
      key: result.key,
      path: result.path,
      label: result.label,
      badge: result.badge,
      closesAtMs: result.closesAt?.getTime() ?? null,
    }
    await storage.setItem(CACHE_KEY, { locale, fetchedAt: now, prompt })
    return stillOpen(prompt, now)
  } catch (error) {
    log.warn("could not fetch the survey prompt", { error })
    return usable ? stillOpen(usable.prompt, now) : null
  }
}

/** Where the entry leads: the survey's page on the website, marked as reached from here. */
export function buildSurveyPromptUrl(prompt: Pick<SurveyPrompt, "path">, websiteUrl: string) {
  const url = new URL(prompt.path, websiteUrl)
  url.searchParams.set("from", SURVEY_PROMPT_SOURCE)
  return url.toString()
}

/** Keys of the surveys whose entry the reader has clicked: their badge is gone. */
export async function getClickedSurveyPromptKeys(): Promise<string[]> {
  const parsed = z.array(z.string()).safeParse(await storage.getItem(CLICKED_KEY))
  return parsed.success ? parsed.data : []
}

export async function markSurveyPromptClicked(key: string): Promise<string[]> {
  const keys = await getClickedSurveyPromptKeys()
  if (keys.includes(key)) {
    return keys
  }
  const next = [...keys, key].slice(-MAX_CLICKED_KEYS)
  await storage.setItem(CLICKED_KEY, next)
  return next
}
