import { IconLoader2, IconSparkles } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { SUBTITLES_SOURCE } from "@/utils/constants/subtitles"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { ensureAiSubtitlesAccess } from "@/utils/subtitles/ai/access-guard"
import { subtitlesSourceAtom, subtitlesStore, subtitlesVisibleAtom } from "../../../atoms"
import { useSubtitlesUI } from "../../subtitles-ui-context"
import { SubtitlesSettingsItem } from "./subtitles-settings-item"

export function RequestAiSubtitlesItem() {
  const [pending, setPending] = useState(false)
  const { requestAiSubtitles, supportsAiSubtitles } = useSubtitlesUI()
  const source = useAtomValue(subtitlesSourceAtom, { store: subtitlesStore })
  const isVisible = useAtomValue(subtitlesVisibleAtom, { store: subtitlesStore })
  const buttonId = "read-frog-request-ai-subtitles"

  const usingAi = source === SUBTITLES_SOURCE.AI && isVisible && !pending
  const label = usingAi
    ? i18n.t("subtitles.usingAiSubtitles")
    : i18n.t("subtitles.requestAiSubtitles")

  const handleRequest = async () => {
    if (pending || usingAi) {
      return
    }

    setPending(true)

    try {
      if (!(await ensureAiSubtitlesAccess())) {
        return
      }
      await requestAiSubtitles()
    } finally {
      setPending(false)
    }
  }

  return (
    <SubtitlesSettingsItem
      icon={<IconSparkles className={cn("size-4", usingAi && "text-primary")} />}
      label={label}
      labelFor={buttonId}
    >
      <Button
        id={buttonId}
        type="button"
        variant="ghost-secondary"
        size="icon-sm"
        onClick={handleRequest}
        disabled={pending || usingAi || !supportsAiSubtitles}
      >
        {pending ? (
          <IconLoader2 className="size-3.5 animate-spin" />
        ) : (
          <IconSparkles className={cn("size-3.5", usingAi && "text-primary")} />
        )}
      </Button>
    </SubtitlesSettingsItem>
  )
}
