import type { ReactNode } from "react"
import type { SelectionSession } from "../selection-toolbar/atoms"
import type { AnalyticsSurface } from "@/types/analytics"
import type { AnnotateFailure, AnnotationController } from "@/utils/annotate"
import { useAtom, useAtomValue } from "jotai"
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react"
import { toastManager } from "@/components/ui/base-ui/toast"
import { isAbortError } from "@/components/ui/selection-popover/inline-error"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { classifyFailureReason } from "@/utils/analytics-failure-reason"
import { classifyResolvedProvider } from "@/utils/analytics-provider"
import { disposeAnnotationController, getAnnotationController } from "@/utils/annotate"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getAnnotationShortcut, MAX_ANNOTATION_TEXT_LENGTH } from "@/utils/constants/selection"
import { prepareTranslationText } from "@/utils/host/translate/text-preparation"
import { i18n } from "@/utils/i18n"
import { toSelectionPromptContext } from "@/utils/prompts/selection-context"
import { selectionToolbarTranslateRequestAtom } from "../selection-toolbar/atoms"
import {
  checkSelectionTranslateProvider,
  translateSelection,
} from "../selection-toolbar/translate-button/dispatch"
import { useSelectionShortcuts } from "../selection-toolbar/use-selection-shortcuts"
import { toLiveRange } from "../utils"
import { annotationModeAtom } from "./atoms"

export type AnnotateSurface = Extract<
  AnalyticsSurface,
  "selection_toolbar" | "shortcut" | "annotation_mode"
>

interface AnnotationContextValue {
  /** The slot is on, and the toolbar with it. */
  enabled: boolean
  mode: boolean
  setMode: (mode: boolean) => void
  /** How many annotations the page has. */
  count: number
  /** Annotates the session's selection. False when nothing was annotated. */
  annotate: (session: SelectionSession | null, surface: AnnotateSurface) => boolean
}

const AnnotationContext = createContext<AnnotationContextValue | null>(null)

// The toasts' keys, all without substitutions.
type WarningKey =
  | "annotation.noTextSelected"
  | "annotation.unsupportedPlace"
  | "annotation.tooLong"
  | "annotation.multipleParagraphs"
  | "annotation.translatedTextUnsupported"
  | "annotation.failed"
  | "options.selectionToolbar.errors.providerUnavailable"
  | "options.selectionToolbar.errors.providerDisabled"

const FAILURE_MESSAGE_KEYS: Record<AnnotateFailure, WarningKey> = {
  noBlock: "annotation.unsupportedPlace",
  multiBlock: "annotation.multipleParagraphs",
  translated: "annotation.translatedTextUnsupported",
  empty: "annotation.noTextSelected",
}

function warn(key: WarningKey) {
  toastManager.add({ type: "error", title: i18n.t(key) })
}

const EMPTY: never[] = []

// One controller for the page, and the one way to annotate on it: from the
// toolbar's pen, its key, or annotation mode. The meaning comes from the same
// translation the translate button would show, on the same provider.
function useAnnotationController(): AnnotationContextValue {
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const translateRequest = useAtomValue(selectionToolbarTranslateRequestAtom)
  const [mode, setModeState] = useAtom(annotationModeAtom)
  const enabled = selectionToolbar.enabled && selectionToolbar.annotation.enabled
  const controllerRef = useRef<AnnotationController | null>(null)
  const inFlight = useRef(new Map<string, AbortController>())

  const getController = useCallback(() => {
    controllerRef.current ??= getAnnotationController({
      removeLabel: i18n.t("annotation.remove"),
    })
    return controllerRef.current
  }, [])

  // A gloss on its way to an annotation the reader removed is not wanted;
  // on unmount, none of them are.
  useEffect(() => {
    const controller = getController()
    const pending = inFlight.current
    const unsubscribe = controller.registry.subscribe(() => {
      for (const [id, abort] of pending) {
        if (!controller.registry.get(id)) {
          abort.abort()
          pending.delete(id)
        }
      }
    })
    return () => {
      unsubscribe()
      for (const abort of pending.values()) abort.abort()
      pending.clear()
      controllerRef.current = null
      disposeAnnotationController()
    }
  }, [getController])

  const subscribe = useCallback(
    (listener: () => void) => getController().registry.subscribe(listener),
    [getController],
  )
  const records = useSyncExternalStore(
    subscribe,
    () => getController().registry.all(),
    () => EMPTY,
  )

  const setMode = useCallback(
    (next: boolean) => {
      setModeState(next && enabled)
    },
    [enabled, setModeState],
  )

  useEffect(() => {
    if (!enabled && mode) setModeState(false)
  }, [enabled, mode, setModeState])

  // Esc leaves the mode: with the toolbar out of the way, the pill is the
  // only other way out.
  useEffect(() => {
    if (!mode) return undefined
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return
      setModeState(false)
    }
    window.addEventListener("keydown", handleKeydown)
    return () => window.removeEventListener("keydown", handleKeydown)
  }, [mode, setModeState])

  const annotate = useCallback(
    (session: SelectionSession | null, surface: AnnotateSurface): boolean => {
      const snapshot = session?.selectionSnapshot
      if (!snapshot || snapshot.text === "") {
        warn("annotation.noTextSelected")
        return false
      }
      if (snapshot.textControl || snapshot.ranges.length === 0) {
        warn("annotation.unsupportedPlace")
        return false
      }
      if (snapshot.text.length > MAX_ANNOTATION_TEXT_LENGTH) {
        warn("annotation.tooLong")
        return false
      }
      const precheck = checkSelectionTranslateProvider(translateRequest.provider)
      if (precheck) {
        warn(`options.selectionToolbar.errors.${precheck}` as const)
        return false
      }

      let range: Range
      try {
        range = toLiveRange(snapshot.ranges[0]!)
      } catch {
        warn("annotation.unsupportedPlace")
        return false
      }

      const controller = getController()
      const result = controller.annotate(range)
      if (!result.ok) {
        warn(FAILURE_MESSAGE_KEYS[result.reason])
        return false
      }
      // The selection's own highlight paints over the mark; the mark is the
      // point now.
      window.getSelection()?.collapseToEnd()

      const { record } = result
      const preparedText = prepareTranslationText(snapshot.text)
      const analyticsContext = createFeatureUsageContext(ANALYTICS_FEATURE.WORD_ANNOTATION, surface)
      const providerAnalytics = classifyResolvedProvider(translateRequest.provider)
      const observed = {
        char_count: preparedText.length,
        target_language: translateRequest.language.targetCode,
      }

      if (!record.glossFits) {
        // The block cannot make room between its lines: the mark stands alone.
        controller.setGloss(record.id, "")
        toastManager.add({ type: "info", title: i18n.t("annotation.markOnly") })
        void trackFeatureUsed({
          ...analyticsContext,
          ...providerAnalytics,
          ...observed,
          outcome: "success",
        })
        return true
      }

      const provider = translateRequest.provider!
      void translateSelection({
        preparedText,
        provider,
        translateRequest,
        selectionContext: toSelectionPromptContext(session.contextSnapshot.paragraphs),
        registerAbortController: (abort) => {
          inFlight.current.set(record.id, abort)
        },
      })
        .then((output) => {
          inFlight.current.delete(record.id)
          if (!controller.registry.get(record.id)) return
          const gloss = output.trim()
          if (gloss === "") {
            controller.remove(record.id)
            warn("annotation.failed")
            void trackFeatureUsed({
              ...analyticsContext,
              ...providerAnalytics,
              ...observed,
              outcome: "failure",
              failure_reason: "invalid_output",
            })
            return
          }
          controller.setGloss(record.id, gloss)
          void trackFeatureUsed({
            ...analyticsContext,
            ...providerAnalytics,
            ...observed,
            outcome: "success",
          })
        })
        .catch((error: unknown) => {
          inFlight.current.delete(record.id)
          if (isAbortError(error)) return
          controller.remove(record.id)
          const message = error instanceof Error && error.message ? error.message : ""
          toastManager.add({
            type: "error",
            title: i18n.t("annotation.failed"),
            ...(message ? { description: message } : {}),
          })
          void trackFeatureUsed({
            ...analyticsContext,
            ...providerAnalytics,
            ...observed,
            outcome: "failure",
            failure_reason: classifyFailureReason(error),
          })
        })
      return true
    },
    [getController, translateRequest],
  )

  // The key annotates like the pen; with nothing selected it lets the page
  // have the keystroke rather than complain.
  useSelectionShortcuts(
    { annotate: enabled ? getAnnotationShortcut(selectionToolbar.annotation) : undefined },
    (_, session) => {
      if (!session?.selectionSnapshot.text) return false
      return annotate(session, ANALYTICS_SURFACE.SHORTCUT)
    },
  )

  return useMemo(
    () => ({ enabled, mode: mode && enabled, setMode, count: records.length, annotate }),
    [annotate, enabled, mode, records.length, setMode],
  )
}

export function AnnotationProvider({ children }: { children: ReactNode }) {
  const value = useAnnotationController()
  return <AnnotationContext value={value}>{children}</AnnotationContext>
}

export function useAnnotation(): AnnotationContextValue {
  const context = use(AnnotationContext)
  if (!context) {
    throw new Error("Annotation must be used within AnnotationProvider.")
  }
  return context
}
