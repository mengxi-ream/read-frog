import { IconFileTextAi, IconLoader2 } from "@tabler/icons-react"
import { useQueryClient } from "@tanstack/react-query"
import { useAtom, useAtomValue } from "jotai"
import { useEffect, useRef, useState } from "react"
import { match } from "ts-pattern"
import { browser } from "#imports"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { featureProviderRefAtom } from "@/utils/atoms/provider"
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
  const providerRef = useAtomValue(featureProviderRefAtom("videoSubtitles"))
  const [checking, setChecking] = useState(false)
  const openRequestId = useRef(0)
  const anchor = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const invalidateOpen = () => {
      openRequestId.current++
    }
    // Subscribe synchronously so even a batched A -> null -> A invalidates old checks.
    const unsubscribe = subtitlesStore.sub(currentVideoIdAtom, () => {
      invalidateOpen()
      setChecking(false)
    })
    return () => {
      unsubscribe()
      invalidateOpen()
    }
  }, [])

  if (!supportsSidebar) {
    return null
  }

  const open = async () => {
    const videoId = subtitlesStore.get(currentVideoIdAtom)
    if (videoId === null) return

    const requestId = ++openRequestId.current
    const isCurrent = () =>
      requestId === openRequestId.current && videoId === subtitlesStore.get(currentVideoIdAtom)
    // A cached summary means both checks passed once already; re-running them
    // would make reopening wait on a round trip for an answer we have.
    if (queryClient.getQueryData(videoSummaryQueryKey(videoId, language.targetCode, providerRef))) {
      setChecking(false)
      setOpen(true)
      return
    }

    setChecking(true)
    try {
      const availability = await checkVideoSummaryAvailability()
      if (!isCurrent()) return
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
              url: browser.runtime.getURL("/options.html#/api-providers?section=feature-providers"),
            },
          )
          return true
        })
        .exhaustive()
      if (blocked) {
        return
      }

      const hasSubtitles = await hasSubtitlesAvailable()
      if (!isCurrent()) return
      if (!hasSubtitles) {
        showAnchoredSubtitlesToast(
          i18n.t("subtitles.sidebar.summary.needsSubtitles"),
          anchor.current,
        )
        return
      }

      setOpen(true)
    } catch {
      if (isCurrent()) {
        showAnchoredSubtitlesToast(i18n.t("subtitles.sidebar.summary.failedTitle"), anchor.current)
      }
    } finally {
      if (requestId === openRequestId.current) {
        setChecking(false)
      }
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
