import type { FloatingButtonSide } from "@/types/config/floating-button"
import { useAtomValue, useSetAtom } from "jotai"
import { i18n } from "#imports"
import { TranslationHubIcon } from "@/components/icons/translation-hub-icon"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { hasLoadedTranslationHubAtom, isSideOpenAtom } from "../../atoms"
import { openTranslationHubSidePanel } from "../../utils/translation-hub-panel"
import HiddenButton from "./components/hidden-button"

export default function TranslationHubButton({
  className,
  side = "right",
  expanded = false,
}: {
  className?: string
  side?: FloatingButtonSide
  expanded?: boolean
}) {
  const setIsSideOpen = useSetAtom(isSideOpenAtom)
  const setHasLoadedTranslationHub = useSetAtom(hasLoadedTranslationHubAtom)
  const translateConfig = useAtomValue(configFieldsAtomMap.translate)

  return (
    <HiddenButton
      icon={<TranslationHubIcon className="h-5 w-5" />}
      ariaLabel={i18n.t("popup.hub.tooltip")}
      className={className}
      side={side}
      expanded={expanded}
      onClick={() => {
        openTranslationHubSidePanel({
          setHasLoadedTranslationHub,
          setIsSideOpen,
          splitPanelMode: translateConfig.page.splitPanelMode,
        })
      }}
    />
  )
}
