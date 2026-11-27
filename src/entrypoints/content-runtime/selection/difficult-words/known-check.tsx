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
 * one press says "I know it", without opening the card. A bare ✓ does not say
 * what it does, so under the pointer (or the keyboard focus) it grows into a
 * pill that reads "I know it ✓". It grows to the left, from the ✓'s own
 * right edge, so the ✓ stays under the pointer and the pill cannot run off
 * the right of the window.
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
  const description = i18n.t("difficultWords.markKnown")
  return (
    <button
      type="button"
      aria-label={description}
      className={cn(
        NOTRANSLATE_CLASS,
        SELECTION_CONTENT_OVERLAY_LAYERS.selectionOverlay,
        "group/known pointer-events-auto fixed flex cursor-pointer items-center rounded-full border border-border bg-popover text-popover-foreground shadow-md transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
      style={{
        height: SIZE_PX,
        minWidth: SIZE_PX,
        // Placed by its right edge (translated back by its own width), so the ✓
        // stays where it was while the label grows to the left of it.
        left: Math.min(rect.right + SIZE_PX / 2, window.innerWidth),
        transform: "translateX(-100%)",
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
      {/* The label is always in the tree, clipped to nothing until the pill is under the pointer or focused. */}
      <span
        aria-hidden="true"
        className="max-w-0 overflow-hidden pl-0 text-xs leading-none font-medium whitespace-nowrap transition-[max-width,padding] duration-150 group-hover/known:max-w-40 group-hover/known:pl-2 group-focus-visible/known:max-w-40 group-focus-visible/known:pl-2"
      >
        {i18n.t("difficultWords.known")}
      </span>
      {/* 18px: the 20px circle less its 1px border, so the ✓ sits where it did with no label. */}
      <span className="flex size-[18px] shrink-0 items-center justify-center">
        <IconCheck className="size-3" strokeWidth={3} />
      </span>
    </button>
  )
}
