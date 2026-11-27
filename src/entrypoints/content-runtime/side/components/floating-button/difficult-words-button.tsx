import type { FloatingButtonSide } from "@/types/config/floating-button"
import { IconCheck, IconHighlight } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  difficultWordsTab,
  useDifficultWordsAccess,
  useDifficultWordsTabState,
} from "@/utils/difficult-words/tab-state"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import HiddenButton from "./components/hidden-button"

/**
 * Switches difficult-word marking on the page, beside the translate button:
 * the two page-wide switches, alike down to the check when on.
 */
export default function DifficultWordsButton({
  side = "right",
  expanded = false,
}: {
  side?: FloatingButtonSide
  expanded?: boolean
}) {
  const difficultWords = useAtomValue(configFieldsAtomMap.difficultWords)
  // Asked when the button mounts, not when it expands: the answer adds a
  // button above the frog, which must not move under the pointer.
  const access = useDifficultWordsAccess(difficultWords.enabled)
  const { enabled, count } = useDifficultWordsTabState()

  if (!difficultWords.enabled) return null
  // On, it can always be switched off, whatever became of the account.
  if (!enabled && access.data !== "allowed" && access.data !== "unknown") return null

  return (
    <HiddenButton
      icon={<IconHighlight className="h-5 w-5" />}
      label={
        enabled
          ? i18n.t("difficultWords.clearCount", [String(count)])
          : i18n.t("difficultWords.scanTooltip")
      }
      side={side}
      expanded={expanded}
      onClick={() => {
        difficultWordsTab.setEnabled(!enabled, ANALYTICS_SURFACE.FLOATING_BUTTON)
      }}
    >
      <IconCheck
        className={cn(
          "absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-success text-white",
          enabled ? "block" : "hidden",
        )}
      />
    </HiddenButton>
  )
}
