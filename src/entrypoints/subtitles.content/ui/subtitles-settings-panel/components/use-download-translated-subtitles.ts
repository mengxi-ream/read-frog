import type { DownloadTranslatedSubtitlesMessageTone } from "./download-translated-subtitles.constants"
import { useAtomValue } from "jotai"
import { useEffect, useState } from "react"
import { i18n } from "#imports"
import {
  TranslatedDownloadPhase,
  translatedSubtitlesDownloadStatusAtom,
} from "../../../atoms"
import { useSubtitlesUI } from "../../subtitles-ui-context"
import {
  DOWNLOAD_TRANSLATED_SUBTITLES_MESSAGE_TONE,
  DOWNLOAD_TRANSLATED_SUBTITLES_PREPARING_MESSAGE_DELAY_MS,
} from "./download-translated-subtitles.constants"

function getMessageTone(
  phase: TranslatedDownloadPhase,
  message: string | null,
): DownloadTranslatedSubtitlesMessageTone | null {
  if (phase === TranslatedDownloadPhase.Complete) {
    return DOWNLOAD_TRANSLATED_SUBTITLES_MESSAGE_TONE.Success
  }

  return message !== null ? DOWNLOAD_TRANSLATED_SUBTITLES_MESSAGE_TONE.Muted : null
}

export function useDownloadTranslatedSubtitles() {
  const status = useAtomValue(translatedSubtitlesDownloadStatusAtom)
  const { downloadTranslatedSubtitles } = useSubtitlesUI()
  const [showPreparingMessage, setShowPreparingMessage] = useState(false)
  const shouldShowPreparingMessageAfterDelay = status.phase === TranslatedDownloadPhase.Checking
    || status.phase === TranslatedDownloadPhase.Preparing

  useEffect(() => {
    if (!shouldShowPreparingMessageAfterDelay) {
      // eslint-disable-next-line react/set-state-in-effect
      setShowPreparingMessage(false)
      return
    }

    const timeoutId = setTimeout(
      setShowPreparingMessage,
      DOWNLOAD_TRANSLATED_SUBTITLES_PREPARING_MESSAGE_DELAY_MS,
      true,
    )
    return () => clearTimeout(timeoutId)
  }, [shouldShowPreparingMessageAfterDelay])

  const preparingMessage = showPreparingMessage
    ? i18n.t("subtitles.actions.downloadTranslatedPreparing")
    : null

  const message = {
    [TranslatedDownloadPhase.Preparing]: preparingMessage,
    [TranslatedDownloadPhase.Translating]: i18n.t("subtitles.actions.downloadTranslatedTranslating"),
    [TranslatedDownloadPhase.Complete]: i18n.t("subtitles.actions.downloadTranslatedComplete"),
    [TranslatedDownloadPhase.Idle]: null,
    [TranslatedDownloadPhase.Checking]: preparingMessage,
  }[status.phase]
  const messageTone = getMessageTone(status.phase, message)
  const isRunning = status.phase === TranslatedDownloadPhase.Preparing
    || status.phase === TranslatedDownloadPhase.Translating
    || status.phase === TranslatedDownloadPhase.Checking

  return {
    message,
    messageTone,
    progress: status.phase === TranslatedDownloadPhase.Translating ? status.progress : null,
    isRunning,
    download: downloadTranslatedSubtitles,
  }
}
