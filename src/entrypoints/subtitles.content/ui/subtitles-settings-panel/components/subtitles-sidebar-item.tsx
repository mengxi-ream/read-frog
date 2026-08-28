import { IconFileTextAi, IconLoader2 } from "@tabler/icons-react"
import { useQueryClient } from "@tanstack/react-query"
import { useAtom, useAtomValue } from "jotai"
import { useRef, useState } from "react"
import { match } from "ts-pattern"
import { browser } from "#imports"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { showAnchoredSubtitlesToast } from "@/utils/subtitles/toast"
import {
  checkVideoSummaryAvailability,
  videoSummaryQueryKey,
} from "@/utils/subtitles/video-summary"
import { currentVideoIdAtom, subtitlesSidebarOpenAtom, subtitlesStore } from "../../../atoms"
import { useSubtitlesUI } from "../../subtitles-ui-context"
import { SubpageMenuEntry } from "./subpage-menu-entry"

export function SubtitlesSidebarItem() {
  const { supportsSidebar, hasSubtitlesAvailable } = useSubtitlesUI()
  const [isOpen, setOpen] = useAtom(subtitlesSidebarOpenAtom, { store: subtitlesStore })
  const queryClient = useQueryClient()
  const language = useAtomValue(configFieldsAtomMap.language)
  const videoSubtitles = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const videoId = useAtomValue(currentVideoIdAtom, { store: subtitlesStore })
  const [checking, setChecking] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)

  if (!supportsSidebar) {
    return null
  }

  const open = async () => {
    // A cached summary means both checks passed once already; re-running them
    // would make reopening wait on a round trip for an answer we have.
    if (
      queryClient.getQueryData(
        videoSummaryQueryKey(
          videoId,
          language.targetCode,
          providersConfig,
          videoSubtitles.providerId,
        ),
      )
    ) {
      setOpen(true)
      return
    }

    setChecking(true)
    try {
      const availability = await checkVideoSummaryAvailability()
      const blocked = match(availability)
        .with({ status: "ok" }, () => false)
        // Already actionable; a settings link would point away from it.
        .with({ status: "hostedUnavailable" }, ({ message }) => {
          showAnchoredSubtitlesToast(message, anchor.current)
          return true
        })
        .with({ status: "needsModel" }, () => {
          showAnchoredSubtitlesToast(
            i18n.t("subtitles.sidebar.summary.needsModel"),
            anchor.current,
            {
              label: i18n.t("subtitles.sidebar.summary.openSettings"),
              url: browser.runtime.getURL("/options.html#/api-providers"),
            },
          )
          return true
        })
        .exhaustive()
      if (blocked) {
        return
      }

      if (!(await hasSubtitlesAvailable())) {
        showAnchoredSubtitlesToast(
          i18n.t("subtitles.sidebar.summary.needsSubtitles"),
          anchor.current,
        )
        return
      }

      setOpen(true)
    } finally {
      setChecking(false)
    }
  }

  return (
    <SubpageMenuEntry
      ref={anchor}
      icon={
        checking ? (
          <IconLoader2 className="size-4 animate-spin" />
        ) : (
          <IconFileTextAi className="size-4" />
        )
      }
      label={i18n.t("subtitles.sidebar.menu.label")}
      onClick={() => (isOpen ? setOpen(false) : void open())}
      pressed={isOpen}
    />
  )
}
