import type { FloatingButtonSide } from "@/types/config/floating-button"
import { RiTranslate } from "@remixicon/react"
import { IconCheck } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { sendMessage } from "@/utils/message"
import { cn } from "@/utils/styles/utils"
import { enablePageTranslationAtom } from "../../atoms"
import HiddenButton from "./components/hidden-button"

export default function TranslateButton({
  className,
  side = "right",
  expanded = false,
}: {
  className?: string
  side?: FloatingButtonSide
  expanded?: boolean
}) {
  const translationState = useAtomValue(enablePageTranslationAtom)
  const isEnabled = translationState.enabled

  return (
    <HiddenButton
      icon={<RiTranslate className="h-5 w-5" />}
      className={className}
      side={side}
      expanded={expanded}
      onClick={() => {
        void sendMessage("tryToSetEnablePageTranslationOnContentScript", { enabled: !isEnabled })
      }}
    >
      <IconCheck
        className={cn(
          "absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-green-500 text-white",
          isEnabled ? "block" : "hidden",
        )}
      />
    </HiddenButton>
  )
}
