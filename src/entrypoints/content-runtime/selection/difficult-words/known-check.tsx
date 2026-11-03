import { IconCheck } from "@tabler/icons-react"
import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"
import {
  SELECTION_CONTENT_OVERLAY_LAYERS,
  SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE,
} from "@/utils/constants/selection-overlay-layers"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

const SIZE_PX = 20

/**
 * The ✓ that appears at the top right of a marked word the pointer rests on:
 * one press says "I know it", without opening the card.
 */
export function KnownCheck({
  rect,
  onPress,
  onPointerEnter,
  onPointerLeave,
}: {
  /** The word's last line, in viewport px. */
  rect: { right: number; top: number }
  onPress: () => void
  onPointerEnter: () => void
  onPointerLeave: () => void
}) {
  const label = i18n.t("difficultWords.markKnown")
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        NOTRANSLATE_CLASS,
        SELECTION_CONTENT_OVERLAY_LAYERS.selectionOverlay,
        "pointer-events-auto fixed flex cursor-pointer items-center justify-center rounded-full border border-border bg-popover text-popover-foreground shadow-md transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
      style={{
        width: SIZE_PX,
        height: SIZE_PX,
        left: Math.min(rect.right - SIZE_PX / 2, window.innerWidth - SIZE_PX),
        top: Math.max(rect.top - SIZE_PX + 4, 0),
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      // The press must not reach the page, or its selection and click handlers.
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onPress()
      }}
      {...{ [SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE]: "" }}
    >
      <IconCheck className="size-3" strokeWidth={3} />
    </button>
  )
}
