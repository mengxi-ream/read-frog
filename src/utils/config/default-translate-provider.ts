import type { Config } from "@/types/config/config"
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
import { getLocalConfig, setLocalConfig } from "./storage"

/**
 * Move a fresh install onto Google Translate when this network can actually reach it.
 *
 * A fresh config ships with Microsoft Translate because it works everywhere, including the
 * networks where Google is blocked — that keeps install itself off the network, so the first
 * config write and the guide tab never wait on a probe that, on a blocked network, does not
 * fail fast but simply hangs. Google is the better default where it works, so once the user
 * is set up we probe the real endpoint and promote it.
 *
 * Only slots still holding the Microsoft default are rewritten, so a user who picked a
 * provider before the probe answered keeps their choice, and a Microsoft-by-choice install is
 * never revisited (the caller runs this only for a config that was just created).
 */
export async function promoteGoogleTranslateDefaultIfReachable(): Promise<void> {
  if (!(await isGoogleTranslateReachable())) {
    logger.info("[Config] Google Translate unreachable, keeping the Microsoft Translate default")
    return
  }

  const config = await getLocalConfig()
  if (!config) {
    return
  }

  const assignments = collectDefaultTranslateFeatures(config)
  if (Object.keys(assignments).length === 0) {
    return
  }

  await setLocalConfig(mergeWithArrayOverwrite(config, buildFeatureProviderPatch(assignments)))
  logger.info("[Config] Google Translate reachable, promoted it to the default translate provider")
}

/** Translate features still pointing at the Microsoft default, mapped to the Google default. */
function collectDefaultTranslateFeatures(config: Config): Partial<Record<FeatureKey, string>> {
  const assignments: Partial<Record<FeatureKey, string>> = {}

  for (const featureKey of FEATURE_KEYS) {
    if (
      FEATURE_PROVIDER_DEFS[featureKey].getProviderId(config) === MICROSOFT_TRANSLATE_PROVIDER_ID
    ) {
      assignments[featureKey] = GOOGLE_TRANSLATE_PROVIDER_ID
    }
  }

  return assignments
}
