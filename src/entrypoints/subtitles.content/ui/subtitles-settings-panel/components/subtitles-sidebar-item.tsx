import { IconBook, IconLoader2 } from "@tabler/icons-react"
import { useAtom, useAtomValue } from "jotai"
import { useEffect, useRef, useState } from "react"
import { i18n } from "@/utils/i18n"
import { showAnchoredSubtitlesToast } from "@/utils/subtitles/toast"
import {
  currentVideoIdAtom,
  sourceTrackAtom,
  subtitlesSidebarOpenAtom,
  subtitlesStore,
} from "../../../atoms"
import { useSubtitlesUI } from "../../subtitles-ui-context"
import { SubpageMenuEntry } from "./subpage-menu-entry"

export function SubtitlesSidebarItem() {
  const { supportsSidebar, hasSubtitlesAvailable } = useSubtitlesUI()
  const [isOpen, setOpen] = useAtom(subtitlesSidebarOpenAtom, { store: subtitlesStore })
  const sourceTrack = useAtomValue(sourceTrackAtom, { store: subtitlesStore })
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
    // A loaded track is proof the video has subtitles, so the probe below would
    // only re-answer a question already settled.
    if (sourceTrack.length > 0) {
      setChecking(false)
      setOpen(true)
      return
    }

    setChecking(true)
    try {
      const hasSubtitles = await hasSubtitlesAvailable()
      if (!isCurrent()) return
      if (!hasSubtitles) {
        showAnchoredSubtitlesToast(i18n.t("subtitles.sidebar.needsSubtitles"), anchor.current)
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
        checking ? <IconLoader2 className="size-4 animate-spin" /> : <IconBook className="size-4" />
      }
      label={i18n.t("subtitles.sidebar.menu.label")}
      onClick={() => (isOpen ? setOpen(false) : void open())}
      pressed={isOpen}
    />
  )
}
