import { IconExclamationCircle, IconLoader2, IconSubtitlesAi } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { use, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { SUBTITLES_SOURCE } from "@/utils/constants/subtitles"
import { i18n } from "@/utils/i18n"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { cn } from "@/utils/styles/utils"
import { ensureAiSubtitlesAccess } from "@/utils/subtitles/ai/access-guard"
import { setAiSubtitlesToastAnchor } from "@/utils/subtitles/toast"
import { subtitlesSourceAtom, subtitlesStore, subtitlesVisibleAtom } from "../../../atoms"
import { useSubtitlesUI } from "../../subtitles-ui-context"
import { SubtitlesSettingsItem } from "./subtitles-settings-item"

export function RequestAiSubtitlesItem() {
  const [pending, setPending] = useState(false)
  const { requestAiSubtitles, supportsAiSubtitles } = useSubtitlesUI()
  const shadowWrapper = use(ShadowWrapperContext)
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
      icon={<IconSubtitlesAi className={cn("size-4", usingAi && "text-primary")} />}
      label={
        <span className="inline-flex items-center gap-1.5">
          <span className="truncate">{label}</span>
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex shrink-0 items-center" />}>
              <IconExclamationCircle className="size-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent
              container={shadowWrapper}
              className="max-w-64 border border-border bg-popover text-popover-foreground"
            >
              {i18n.t("subtitles.aiSubtitlesHint")}
            </TooltipContent>
          </Tooltip>
        </span>
      }
      labelFor={buttonId}
    >
      <Button
        id={buttonId}
        // Anchors the refusal toast, so "you need a plan" lands on the control
        // that was pressed instead of in the far corner of the page.
        ref={setAiSubtitlesToastAnchor}
        type="button"
        variant="ghost-secondary"
        size="icon-sm"
        onClick={handleRequest}
        disabled={pending || usingAi || !supportsAiSubtitles}
      >
        {pending && <IconLoader2 className="size-3.5 animate-spin" />}
      </Button>
    </SubtitlesSettingsItem>
  )
}
