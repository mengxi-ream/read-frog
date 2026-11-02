import { Icon } from "@iconify/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Switch } from "@/components/ui/base-ui/switch"
import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"
import {
  SELECTION_CONTENT_OVERLAY_LAYERS,
  SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE,
} from "@/utils/constants/selection-overlay-layers"
import { i18n } from "@/utils/i18n"
import { ANNOTATION_ICON } from "@/utils/iconify/bundled-icons"
import { useAnnotation } from "./provider"

/**
 * Annotation mode's one piece of UI: a pill at the bottom of the page that
 * says the mode is on, counts what was annotated, and switches it off. With
 * the toolbar out of the way, it (and Esc) is the way out.
 */
export function AnnotationModePill() {
  const { mode, setMode, count } = useAnnotation()
  const label = i18n.t("annotation.modeLabel")
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {mode && (
        <motion.div
          key="annotation-mode-pill"
          role="status"
          className={`${NOTRANSLATE_CLASS} pointer-events-auto fixed bottom-4 left-1/2 flex items-center gap-2.5 rounded-full border border-border/60 bg-popover py-1.5 pr-2 pl-3 text-sm text-popover-foreground shadow-lg ${SELECTION_CONTENT_OVERLAY_LAYERS.selectionOverlay}`}
          style={{ x: "-50%" }}
          // No filter here: a blur, even blur(0), keeps the text in a
          // composited layer with grayscale antialiasing, and every count
          // change would flash it.
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          // Leaves the way it came: down past the bottom edge, fading as it
          // goes. AnimatePresence unmounts it once the exit has played, so
          // nothing is left parked below the viewport.
          exit={
            reduceMotion
              ? { opacity: 0, transition: { duration: 0.12 } }
              : { opacity: 0, y: 80, transition: { duration: 0.22, ease: "easeIn" } }
          }
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
          {...{ [SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE]: "" }}
        >
          <span className="flex shrink-0 items-center">
            <Icon icon={ANNOTATION_ICON} className="size-4" />
          </span>
          <span className="whitespace-nowrap">{label}</span>
          <span className="min-w-6 rounded-full bg-muted px-1.5 py-0.5 text-center font-mono text-xs text-muted-foreground tabular-nums">
            {count}
          </span>
          <Switch
            size="sm"
            checked
            aria-label={i18n.t("annotation.exitMode")}
            onCheckedChange={(checked) => setMode(checked)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
