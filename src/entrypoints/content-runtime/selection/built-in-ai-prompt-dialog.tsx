import type { BuiltInAiPromptAction } from "@/types/analytics"
import { useAtomValue, useSetAtom } from "jotai"
import { use, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/base-ui/dialog"
import { toastManager } from "@/components/ui/base-ui/toast"
import { trackBuiltInAiPromptAction } from "@/utils/analytics"
import { configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { getProviderConfigById } from "@/utils/config/helpers"
import {
  buildFeatureProviderPatch,
  getFeatureLabelI18nKey,
} from "@/utils/constants/feature-providers"
import { SELECTION_CONTENT_OVERLAY_LAYERS } from "@/utils/constants/selection-overlay-layers"
import {
  closeBuiltInAiPrompt,
  toAnalyticsPromptKind,
  useBuiltInAiPrompt,
} from "@/utils/content-runtime/built-in-ai-prompt"
import { logInUrl, pricingUrl } from "@/utils/error-action"
import { i18n } from "@/utils/i18n"
import { createLogger } from "@/utils/logging/logger"
import { sendMessage } from "@/utils/message"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"

const log = createLogger("content-runtime/built-in-ai-prompt-dialog")

/**
 * What someone sees when Built-in AI refuses a translate feature they ran. A guest is
 * asked to log in; an account whose pool is spent, to upgrade. Either can instead switch
 * the feature to the machine translator this network reaches (Google, else Microsoft)
 * and run it again.
 */
export function BuiltInAiPromptDialog() {
  const request = useBuiltInAiPrompt()
  const shadowWrapper = use(ShadowWrapperContext)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const setConfig = useSetAtom(writeConfigAtom)
  const [isSwitching, setIsSwitching] = useState(false)

  const trackAction = (action: BuiltInAiPromptAction) => {
    if (!request) {
      return
    }
    void trackBuiltInAiPromptAction({
      feature: request.analyticsFeature,
      kind: toAnalyticsPromptKind(request.kind),
      presentation: "dialog",
      trigger: request.trigger,
      action,
    })
  }

  const openWebsite = () => {
    if (!request) {
      return
    }
    trackAction(request.kind === "upgrade" ? "upgrade" : "log_in")
    closeBuiltInAiPrompt()
    void sendMessage("openPage", {
      url:
        request.kind === "upgrade"
          ? pricingUrl("extension_quota_exhausted", request.analyticsFeature)
          : logInUrl(),
      active: true,
    })
  }

  const switchToMachineTranslation = async () => {
    if (!request) {
      return
    }

    trackAction("machine_translation")
    setIsSwitching(true)
    try {
      const providerId = await sendMessage("getFreeTranslateProviderId")
      await setConfig(buildFeatureProviderPatch({ [request.feature]: providerId }))
      closeBuiltInAiPrompt()
      toastManager.add({
        type: "success",
        title: i18n.t("hostedAi.builtInAiPrompt.switched", [
          i18n.t(getFeatureLabelI18nKey(request.feature)),
          getProviderConfigById(providersConfig, providerId)?.name ?? providerId,
        ]),
      })
      request.retry?.()
    } catch (error) {
      log.error("Failed to switch to machine translation", { error })
      toastManager.add({ type: "error", title: i18n.t("hostedAi.builtInAiPrompt.switchFailed") })
    } finally {
      setIsSwitching(false)
    }
  }

  const isUpgrade = request?.kind === "upgrade"

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        // Only a close the reader made lands here: the buttons close the dialog themselves.
        if (!open) {
          trackAction("dismissed")
          closeBuiltInAiPrompt()
        }
      }}
    >
      <DialogContent
        container={shadowWrapper ?? document.body}
        className={`${SELECTION_CONTENT_OVERLAY_LAYERS.popoverOverlay} pointer-events-auto`}
        forceRenderOverlay
        overlayClassName={`${SELECTION_CONTENT_OVERLAY_LAYERS.popoverOverlay} pointer-events-auto`}
      >
        <DialogHeader>
          <DialogTitle>
            {isUpgrade
              ? i18n.t("hostedAi.builtInAiPrompt.upgradeTitle")
              : i18n.t("hostedAi.builtInAiPrompt.logInTitle")}
          </DialogTitle>
          <DialogDescription>
            {!isUpgrade
              ? i18n.t("hostedAi.builtInAiPrompt.logInDescription")
              : request.plan === "pro"
                ? i18n.t("hostedAi.builtInAiPrompt.upgradeDescriptionPro")
                : i18n.t("hostedAi.builtInAiPrompt.upgradeDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSwitching}
            onClick={() => void switchToMachineTranslation()}
          >
            {i18n.t("hostedAi.builtInAiPrompt.useMachineTranslation")}
          </Button>
          <Button type="button" variant="accent" disabled={isSwitching} onClick={openWebsite}>
            {isUpgrade ? i18n.t("action.upgrade") : i18n.t("account.login")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
