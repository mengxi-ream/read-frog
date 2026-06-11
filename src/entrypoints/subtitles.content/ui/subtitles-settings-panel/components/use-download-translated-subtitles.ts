import { useAtomValue } from "jotai"
import { i18n } from "#imports"
import {
  TranslatedDownloadPhase,
  translatedSubtitlesDownloadStatusAtom,
} from "../../../atoms"
import { useSubtitlesUI } from "../../subtitles-ui-context"

export function useDownloadTranslatedSubtitles() {
  const status = useAtomValue(translatedSubtitlesDownloadStatusAtom)
  const { downloadTranslatedSubtitles } = useSubtitlesUI()
  const message = {
    [TranslatedDownloadPhase.Preparing]: i18n.t("subtitles.actions.downloadTranslatedPreparing"),
    [TranslatedDownloadPhase.Translating]: i18n.t("subtitles.actions.downloadTranslatedTranslating"),
    [TranslatedDownloadPhase.Complete]: i18n.t("subtitles.actions.downloadTranslatedComplete"),
    [TranslatedDownloadPhase.Idle]: null,
    [TranslatedDownloadPhase.Error]: null,
  }[status.phase]
  const isRunning = status.phase === TranslatedDownloadPhase.Preparing
    || status.phase === TranslatedDownloadPhase.Translating

  return {
    message,
    progress: status.progress,
    isRunning,
    download: downloadTranslatedSubtitles,
  }
}
