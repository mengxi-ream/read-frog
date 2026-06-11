import { IconExternalLink, IconX } from "@tabler/icons-react"
import { kebabCase } from "case-anything"
import { useAtom, useAtomValue } from "jotai"
import { useEffect, useMemo, useState } from "react"
import { browser, i18n } from "#imports"
import { TranslationHubIcon } from "@/components/icons/translation-hub-icon"
import { Button } from "@/components/ui/base-ui/button"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { APP_NAME } from "@/utils/constants/app"
import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"
import { sendMessage } from "@/utils/message"
import { cn } from "@/utils/styles/utils"
import { hasLoadedTranslationHubAtom, isSideOpenAtom } from "../../atoms"
import { getTranslationHubSidePanelWidth, MIN_MAIN_CONTENT_WIDTH_WITH_SIDE_PANEL, MIN_TRANSLATION_HUB_SIDE_PANEL_WIDTH } from "../../utils/translation-hub-panel"

export default function TranslationHubSidePanel() {
  const [isSideOpen, setIsSideOpen] = useAtom(isSideOpenAtom)
  const [sideContent, setSideContent] = useAtom(configFieldsAtomMap.sideContent)
  const hasLoadedHub = useAtomValue(hasLoadedTranslationHubAtom)
  const [isResizing, setIsResizing] = useState(false)
  const sidePanelUrl = useMemo(
    () => browser.runtime.getURL("/translation-hub.html?embedded=side-panel"),
    [],
  )
  const panelWidth = getTranslationHubSidePanelWidth(sideContent.width)

  useEffect(() => {
    if (!isResizing)
      return

    const handleMouseMove = (e: MouseEvent) => {
      const windowWidth = window.innerWidth
      const maxWidth = Math.max(
        MIN_TRANSLATION_HUB_SIDE_PANEL_WIDTH,
        windowWidth - MIN_MAIN_CONTENT_WIDTH_WITH_SIDE_PANEL,
      )
      const nextWidth = windowWidth - e.clientX
      const clampedWidth = Math.min(maxWidth, Math.max(MIN_TRANSLATION_HUB_SIDE_PANEL_WIDTH, nextWidth))

      void setSideContent({ width: clampedWidth })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    const previousUserSelect = document.body.style.userSelect
    document.body.style.userSelect = "none"

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.userSelect = previousUserSelect
    }
  }, [isResizing, setSideContent])

  useEffect(() => {
    const styleId = `shrink-origin-for-${kebabCase(APP_NAME)}-translation-hub-side-panel`
    let styleTag = document.getElementById(styleId)

    if (isSideOpen) {
      if (!styleTag) {
        styleTag = document.createElement("style")
        styleTag.id = styleId
        document.head.appendChild(styleTag)
      }
      styleTag.textContent = `
        html {
          width: calc(100% - ${panelWidth}px) !important;
          position: relative !important;
          min-height: 100vh !important;
        }
      `
    }
    else if (styleTag) {
      styleTag.remove()
    }

    return () => {
      styleTag?.remove()
    }
  }, [isSideOpen, panelWidth])

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  const openInNewTab = () => {
    void sendMessage("openPage", {
      url: browser.runtime.getURL("/translation-hub.html"),
      active: true,
    })
  }

  return (
    <>
      <aside
        className={cn(
          "bg-background text-foreground fixed top-0 right-0 z-[2147483647] h-full pr-[var(--removed-body-scroll-bar-size,0px)] shadow-2xl transition-transform duration-200 print:hidden",
          NOTRANSLATE_CLASS,
          isSideOpen
            ? "border-border translate-x-0 border-l"
            : "translate-x-full",
        )}
        style={{
          width: `calc(${panelWidth}px + var(--removed-body-scroll-bar-size, 0px))`,
        }}
        aria-hidden={!isSideOpen}
      >
        <div
          className="absolute top-0 left-0 z-10 h-full w-2 cursor-ew-resize bg-transparent"
          onMouseDown={handleResizeStart}
        />

        <div className="flex h-full min-w-0 flex-col">
          <div className="border-border flex h-11 shrink-0 items-center justify-between border-b px-3">
            <div className="flex min-w-0 items-center gap-2">
              <TranslationHubIcon className="text-muted-foreground size-4 shrink-0" />
              <span className="truncate text-sm font-medium">
                {i18n.t("translationHub.title")}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={openInNewTab}
                title={i18n.t("popup.more.translationHub")}
                aria-label={i18n.t("popup.more.translationHub")}
              >
                <IconExternalLink className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setIsSideOpen(false)}
                title="Close"
                aria-label="Close"
              >
                <IconX className="size-4" />
              </Button>
            </div>
          </div>

          {hasLoadedHub && (
            <iframe
              src={sidePanelUrl}
              title={i18n.t("translationHub.title")}
              className="h-0 min-h-0 flex-1 border-0 bg-background"
              allow="clipboard-read; clipboard-write"
            />
          )}
        </div>
      </aside>

      {isResizing && (
        <div className="fixed inset-0 z-[2147483647] cursor-ew-resize bg-transparent print:hidden" />
      )}
    </>
  )
}
