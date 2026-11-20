import { storage } from "#imports"
import {
  GOOGLE_TRANSLATE_PROVIDER_ID,
  MICROSOFT_TRANSLATE_PROVIDER_ID,
} from "@/utils/constants/providers"
import { isGoogleTranslateReachable } from "@/utils/host/translate/api/google"

export type FreeTranslateProviderId =
  | typeof GOOGLE_TRANSLATE_PROVIDER_ID
  | typeof MICROSOFT_TRANSLATE_PROVIDER_ID

/**
 * Session storage outlives the service worker, which restarts all the time, so a browser
 * session probes once. The next session probes again, in case the network changed.
 */
const FREE_TRANSLATE_PROVIDER_STORAGE_KEY = "session:freeTranslateProviderId"

function isFreeTranslateProviderId(value: unknown): value is FreeTranslateProviderId {
  return value === GOOGLE_TRANSLATE_PROVIDER_ID || value === MICROSOFT_TRANSLATE_PROVIDER_ID
}

/**
 * The machine translator for when Built-in AI is not an option: Google Translate where this
 * network reaches it, and otherwise Microsoft Translator, which works everywhere. The
 * website's guide translates with it before anyone has logged in, and a guest who would
 * rather not log in switches to it. Background only: the probe is a real request to Google.
 */
export async function getFreeTranslateProviderId(): Promise<FreeTranslateProviderId> {
  const stored = await storage.getItem<string>(FREE_TRANSLATE_PROVIDER_STORAGE_KEY)
  if (isFreeTranslateProviderId(stored)) {
    return stored
  }

  const providerId = (await isGoogleTranslateReachable())
    ? GOOGLE_TRANSLATE_PROVIDER_ID
    : MICROSOFT_TRANSLATE_PROVIDER_ID
  await storage.setItem(FREE_TRANSLATE_PROVIDER_STORAGE_KEY, providerId)
  return providerId
}
