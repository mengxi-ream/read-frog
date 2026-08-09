import type { FeatureKey } from "@/utils/constants/feature-providers"
import { mergeWithArrayOverwrite } from "@/utils/atoms/config"
import {
  buildFeatureProviderPatch,
  FEATURE_KEYS,
  FEATURE_PROVIDER_DEFS,
} from "@/utils/constants/feature-providers"
import { BUILT_IN_AI_PROVIDER_ID } from "@/utils/constants/provider-ids"
import {
  GOOGLE_TRANSLATE_PROVIDER_ID,
  MICROSOFT_TRANSLATE_PROVIDER_ID,
} from "@/utils/constants/providers"
import { isGoogleTranslateReachable } from "@/utils/host/translate/api/google"
import { getHostedAiStatus } from "@/utils/hosted-ai/status"
import { logger } from "@/utils/logger"
import { backgroundOrpcClient } from "@/utils/orpc/background-client"
import { getLocalConfigAndMeta, setLocalConfig } from "./storage"

/**
 * Pick better translate providers once, after a fresh install.
 *
 * A fresh config ships with Microsoft Translate because it works everywhere, including the
 * networks where Google is blocked — that keeps install itself off the network, so the first
 * config write and the guide tab never wait on a probe that, on a blocked network, does not
 * fail fast but simply hangs. Once the user is set up we probe the real Google endpoint:
 *
 * - Google answers: every translate feature still holding the Microsoft default moves to
 *   Google, the better provider where it works. Slots the user already changed keep their
 *   choice.
 * - Google is blocked: page translation moves to Built-in AI when the signed-in account can
 *   use the hosted provider. Entitlement failures are deliberately silent and leave the
 *   Microsoft default selected — it is the one provider that still works on such networks.
 */
export async function selectFreshTranslateProviders(): Promise<void> {
  const initial = await getLocalConfigAndMeta()

  if (await isGoogleTranslateReachable()) {
    await promoteMicrosoftDefaultsToGoogle()
    return
  }

  let canUseBuiltInAi: boolean
  try {
    const status = await getHostedAiStatus(backgroundOrpcClient, { force: true })
    const normalStatus = status.features.pageTranslation.normal
    // Fresh-install selection depends on access, not the current credit balance.
    // An entitled user keeps Built-in AI selected even when their pool is exhausted.
    canUseBuiltInAi =
      normalStatus.accessAllowed &&
      (normalStatus.available || normalStatus.unavailableReason === "quota_exhausted")
  } catch (error) {
    logger.info("[Config] Hosted AI entitlement check failed; keeping Microsoft Translate", error)
    return
  }

  if (!canUseBuiltInAi) return

  const latest = await getLocalConfigAndMeta()
  const config = latest.value

  // The probes may take seconds. Never overwrite any config edit made while they were in flight.
  if (
    config.pageTranslation.providerId !== MICROSOFT_TRANSLATE_PROVIDER_ID ||
    latest.meta.lastModifiedAt !== initial.meta.lastModifiedAt
  ) {
    return
  }

  await setLocalConfig(
    mergeWithArrayOverwrite(
      config,
      buildFeatureProviderPatch({ pageTranslation: BUILT_IN_AI_PROVIDER_ID }),
    ),
  )
  logger.info("[Config] Google Translate unreachable; selected Built-in AI for page translation")
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
