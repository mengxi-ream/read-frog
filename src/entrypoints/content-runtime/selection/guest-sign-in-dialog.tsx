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
import { configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { getProviderConfigById } from "@/utils/config/helpers"
import {
  buildFeatureProviderPatch,
  getFeatureLabelI18nKey,
} from "@/utils/constants/feature-providers"
import { SELECTION_CONTENT_OVERLAY_LAYERS } from "@/utils/constants/selection-overlay-layers"
import {
  closeGuestSignInPrompt,
  useGuestSignInPrompt,
} from "@/utils/content-runtime/guest-sign-in-prompt"
import { logInUrl } from "@/utils/error-action"
import { i18n } from "@/utils/i18n"
import { createLogger } from "@/utils/logging/logger"
import { sendMessage } from "@/utils/message"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"

const log = createLogger("content-runtime/guest-sign-in-dialog")

/**
 * What a guest sees after running a translate feature on Built-in AI, which needs an
 * account: log in, or switch the feature to the machine translator this network reaches
 * (Google, else Microsoft) and run it again.
 */
export function GuestSignInDialog() {
  const request = useGuestSignInPrompt()
  const shadowWrapper = use(ShadowWrapperContext)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const setConfig = useSetAtom(writeConfigAtom)
  const [isSwitching, setIsSwitching] = useState(false)

  const logIn = () => {
    closeGuestSignInPrompt()
    void sendMessage("openPage", { url: logInUrl(), active: true })
  }

  const switchToMachineTranslation = async () => {
    if (!request) {
      return
    }

    setIsSwitching(true)
    try {
      const providerId = await sendMessage("getFreeTranslateProviderId")
      await setConfig(buildFeatureProviderPatch({ [request.feature]: providerId }))
      closeGuestSignInPrompt()
      toastManager.add({
        type: "success",
        title: i18n.t("hostedAi.guestPrompt.switched", [
          i18n.t(getFeatureLabelI18nKey(request.feature)),
          getProviderConfigById(providersConfig, providerId)?.name ?? providerId,
        ]),
      })
      request.retry?.()
    } catch (error) {
      log.error("Failed to switch to machine translation", { error })
      toastManager.add({ type: "error", title: i18n.t("hostedAi.guestPrompt.switchFailed") })
    } finally {
      setIsSwitching(false)
    }
  }

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) {
          closeGuestSignInPrompt()
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
          <DialogTitle>{i18n.t("hostedAi.guestPrompt.title")}</DialogTitle>
          <DialogDescription>{i18n.t("hostedAi.guestPrompt.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSwitching}
            onClick={() => void switchToMachineTranslation()}
          >
            {i18n.t("hostedAi.guestPrompt.useMachineTranslation")}
          </Button>
          <Button type="button" variant="accent" disabled={isSwitching} onClick={logIn}>
            {i18n.t("account.login")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
