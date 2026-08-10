import type { FeatureKey } from "@/utils/constants/feature-providers"
import { mergeWithArrayOverwrite } from "@/utils/atoms/config"
import {
  buildFeatureProviderPatch,
  FEATURE_KEYS,
  FEATURE_PROVIDER_DEFS,
} from "@/utils/constants/feature-providers"
import {
  GOOGLE_TRANSLATE_PROVIDER_ID,
  MICROSOFT_TRANSLATE_PROVIDER_ID,
} from "@/utils/constants/providers"
import { isGoogleTranslateReachable } from "@/utils/host/translate/api/google"
import { logger } from "@/utils/logger"
import { getLocalConfigAndMeta, setLocalConfig } from "./storage"

/**
 * Pick better translate providers once, after a fresh install.
 *
 * A fresh config ships with Microsoft Translate because it works everywhere, including the
 * networks where Google is blocked — that keeps install itself off the network, so the first
 * config write and the guide tab never wait on a probe that, on a blocked network, does not
 * fail fast but simply hangs. Once the user is set up we probe the real Google endpoint:
 * where Google answers, every translate feature still holding the Microsoft default moves to
 * Google, the better provider where it works. Slots the user already changed keep their
 * choice; where Google is blocked, the Microsoft default stays.
 */
export async function selectFreshTranslateProviders(): Promise<void> {
  if (await isGoogleTranslateReachable()) {
    await promoteMicrosoftDefaultsToGoogle()
  }
}

/** Move every translate feature still pointing at the Microsoft default onto Google. */
async function promoteMicrosoftDefaultsToGoogle(): Promise<void> {
  const { value: config } = await getLocalConfigAndMeta()

  const assignments: Partial<Record<FeatureKey, string>> = {}
  for (const featureKey of FEATURE_KEYS) {
    if (
      FEATURE_PROVIDER_DEFS[featureKey].getProviderId(config) === MICROSOFT_TRANSLATE_PROVIDER_ID
    ) {
      assignments[featureKey] = GOOGLE_TRANSLATE_PROVIDER_ID
    }
  }
  if (Object.keys(assignments).length === 0) {
    return
  }

  await setLocalConfig(mergeWithArrayOverwrite(config, buildFeatureProviderPatch(assignments)))
  logger.info("[Config] Google Translate reachable, promoted it to the default translate provider")
}
