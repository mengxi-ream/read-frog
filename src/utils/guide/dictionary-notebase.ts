import { z } from "zod"
import { storage } from "#imports"
import { env } from "@/env"
import { getRandomUUID } from "@/utils/crypto-polyfill"

export const GUIDE_DICTIONARY_NOTEBASE_ACTION_ID = "default-dictionary"
export const GUIDE_DICTIONARY_NOTEBASE_COMPLETED_STORAGE_KEY = "guideDictionaryNotebaseCompleted"
export const GUIDE_DICTIONARY_NOTEBASE_SESSION_STORAGE_KEY = "guideDictionaryNotebaseSession"
export const GUIDE_DICTIONARY_NOTEBASE_SESSION_TTL_MS = 30 * 60 * 1000
const GUIDE_DICTIONARY_NOTEBASE_ROUTE_PATH_SUFFIX = "/guide/step-3"

export const guideDictionaryNotebaseTrackingSchema = z.object({
  id: z.string().nonempty(),
  actionId: z.literal(GUIDE_DICTIONARY_NOTEBASE_ACTION_ID),
  sourceUrl: z.url(),
  startedAt: z.number(),
  expiresAt: z.number(),
})

export type GuideDictionaryNotebaseTracking = z.infer<typeof guideDictionaryNotebaseTrackingSchema>

export const guideDictionaryNotebaseCompletionInputSchema = z.object({
  trackingId: z.string().nonempty(),
  actionId: z.literal(GUIDE_DICTIONARY_NOTEBASE_ACTION_ID),
  notebaseId: z.string().nonempty(),
  sourceUrl: z.url(),
})

export type GuideDictionaryNotebaseCompletionInput = z.infer<
  typeof guideDictionaryNotebaseCompletionInputSchema
>

const guideDictionaryNotebaseCompletionSchema = guideDictionaryNotebaseCompletionInputSchema.extend(
  {
    completed: z.literal(true),
    completedAt: z.number(),
  },
)

export type GuideDictionaryNotebaseState = {
  completed: boolean
}

function getLocalStorageKey(key: string): `local:${string}` {
  return `local:${key}`
}

export function isGuideDictionaryNotebaseGuideUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    const isOfficialOrigin = env.WXT_OFFICIAL_SITE_ORIGINS.includes(url.origin)
    const normalizedPathname = url.pathname.replace(/\/$/, "")

    return (
      isOfficialOrigin && normalizedPathname.endsWith(GUIDE_DICTIONARY_NOTEBASE_ROUTE_PATH_SUFFIX)
    )
  } catch {
    return false
  }
}

export function canUseGuideDictionaryNotebaseTracking(actionId: string, currentUrl: string) {
  return (
    actionId === GUIDE_DICTIONARY_NOTEBASE_ACTION_ID &&
    isGuideDictionaryNotebaseGuideUrl(currentUrl)
  )
}

export async function getGuideDictionaryNotebaseState(): Promise<GuideDictionaryNotebaseState> {
  const value = await storage.getItem<unknown>(
    getLocalStorageKey(GUIDE_DICTIONARY_NOTEBASE_COMPLETED_STORAGE_KEY),
  )
  const parsed = guideDictionaryNotebaseCompletionSchema.safeParse(value)

  return { completed: parsed.success }
}

export async function startGuideDictionaryNotebaseTracking(sourceUrl: string, now = Date.now()) {
  const state = await getGuideDictionaryNotebaseState()
  if (state.completed || !isGuideDictionaryNotebaseGuideUrl(sourceUrl)) {
    return state
  }

  const tracking: GuideDictionaryNotebaseTracking = {
    id: getRandomUUID(),
    actionId: GUIDE_DICTIONARY_NOTEBASE_ACTION_ID,
    sourceUrl,
    startedAt: now,
    expiresAt: now + GUIDE_DICTIONARY_NOTEBASE_SESSION_TTL_MS,
  }

  await storage.setItem(getLocalStorageKey(GUIDE_DICTIONARY_NOTEBASE_SESSION_STORAGE_KEY), tracking)

  return { completed: false }
}

export async function getActiveGuideDictionaryNotebaseTrackingForAction(
  actionId: string,
  currentUrl: string,
  now = Date.now(),
) {
  if (!canUseGuideDictionaryNotebaseTracking(actionId, currentUrl)) {
    return null
  }

  const state = await getGuideDictionaryNotebaseState()
  if (state.completed) {
    return null
  }

  const value = await storage.getItem<unknown>(
    getLocalStorageKey(GUIDE_DICTIONARY_NOTEBASE_SESSION_STORAGE_KEY),
  )
  const parsed = guideDictionaryNotebaseTrackingSchema.safeParse(value)
  if (!parsed.success) {
    return null
  }

  if (parsed.data.expiresAt <= now) {
    await storage.removeItem(getLocalStorageKey(GUIDE_DICTIONARY_NOTEBASE_SESSION_STORAGE_KEY))
    return null
  }

  if (!isGuideDictionaryNotebaseGuideUrl(parsed.data.sourceUrl)) {
    return null
  }

  return parsed.data
}

export async function markGuideDictionaryNotebaseCompleted(
  input: GuideDictionaryNotebaseCompletionInput,
  now = Date.now(),
) {
  const completionInput = guideDictionaryNotebaseCompletionInputSchema.parse(input)

  await storage.setItem(getLocalStorageKey(GUIDE_DICTIONARY_NOTEBASE_COMPLETED_STORAGE_KEY), {
    ...completionInput,
    completed: true,
    completedAt: now,
  })
  await storage.removeItem(getLocalStorageKey(GUIDE_DICTIONARY_NOTEBASE_SESSION_STORAGE_KEY))

  return { completed: true }
}
