import type { HotkeyChord } from "@tanstack/hotkeys"
import type { DifficultWordsView } from "./session"
import type { DifficultWordsSurface } from "@/utils/difficult-words/types"
import { HotkeyManager } from "@tanstack/hotkeys"
import { useAtomValue, useSetAtom, useStore } from "jotai"
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { toastManager } from "@/components/ui/base-ui/toast"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { UNKNOWN_FEATURE_PROVIDER } from "@/utils/analytics-provider"
import { supportsHighlightApi } from "@/utils/annotate/marks"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { getDifficultWordsShortcut } from "@/utils/constants/difficult-words"
import { difficultWordsTab, useDifficultWordsAccess } from "@/utils/difficult-words/tab-state"
import { i18n } from "@/utils/i18n"
import { logger } from "@/utils/logger"
import { onMessage, sendMessage } from "@/utils/message"
import { isShortcutEmpty, isValidShortcut } from "@/utils/shortcut"
import { useAnnotation } from "../annotation/provider"
import { onSelectionLookup } from "../selection-lookups"
import { difficultWordRequestAtom } from "./atoms"
import { DifficultWordCard } from "./card"
import { KnownCheck } from "./known-check"
import { LevelPicker } from "./level-picker"
import { DifficultWordsSession, showRestrictedNotice, showSignInRequiredNotice } from "./session"

const EMPTY_VIEW: DifficultWordsView = { card: null, check: null, levelLang: null }
const subscribeNothing = () => () => {}
const getEmptyView = () => EMPTY_VIEW

/**
 * Difficult-word marking in this tab: switched on from the popup, the
 * floating button or its key, and off again the same ways. The marks are the
 * page's, so only the top frame runs them.
 */
export function DifficultWords() {
  if (window !== window.top) return null
  return <DifficultWordsRuntime />
}

function DifficultWordsRuntime() {
  const store = useStore()
  const difficultWordsConfig = useAtomValue(configFieldsAtomMap.difficultWords)
  const annotation = useAnnotation()
  const setRequest = useSetAtom(difficultWordRequestAtom)
  const [session, setSession] = useState<DifficultWordsSession | null>(null)
  const sessionRef = useRef<DifficultWordsSession | null>(null)
  const startingRef = useRef(false)
  const annotationRef = useRef(annotation)

  useLayoutEffect(() => {
    annotationRef.current = annotation
  })

  const view = useSyncExternalStore(
    session?.subscribe ?? subscribeNothing,
    session?.getView ?? getEmptyView,
    getEmptyView,
  )

  const disable = useEffectEvent(() => {
    const current = sessionRef.current
    if (!current) return
    sessionRef.current = null
    current.dispose()
    setSession(null)
    difficultWordsTab.update({ enabled: false, count: 0 })
  })

  const enable = useEffectEvent(async (surface: DifficultWordsSurface | null) => {
    if (sessionRef.current || startingRef.current) return
    const config = store.get(configAtom)
    if (!config.difficultWords.enabled) return
    if (!supportsHighlightApi()) {
      toastManager.add({ type: "error", title: i18n.t("difficultWords.unsupportedBrowser") })
      return
    }

    startingRef.current = true
    try {
      const [verdict, translated] = await Promise.all([
        sendMessage("getDifficultWordsAccess", undefined).catch(() => "unknown" as const),
        sendMessage("getEnablePageTranslationFromContentScript", undefined).catch(() => false),
      ])
      if (verdict === "signedOut") {
        showSignInRequiredNotice()
        return
      }
      if (verdict === "denied") {
        showRestrictedNotice()
        return
      }
      const latest = store.get(configAtom)
      // What is on the page is the reader's own language then: nothing to mark.
      if (translated && latest.pageTranslation.mode === "translationOnly") {
        toastManager.add({
          type: "warning",
          title: i18n.t("difficultWords.translationOnlyUnavailable"),
        })
        return
      }

      const next = new DifficultWordsSession(latest.language.targetCode, {
        getConfig: () => store.get(configAtom),
        setRequest,
        isAnnotationMode: () => annotationRef.current.mode,
        annotate: (selection) =>
          annotationRef.current.annotate(selection, ANALYTICS_SURFACE.ANNOTATION_MODE),
        // Out of a scanner callback: the session is not torn down under it.
        onRestricted: () => queueMicrotask(() => disable()),
        onCountChange: (count) => difficultWordsTab.update({ count }),
      })
      sessionRef.current = next
      next.start()
      setSession(next)
      difficultWordsTab.update({ enabled: true, count: 0 })

      if (surface) {
        void trackFeatureUsed({
          ...createFeatureUsageContext(ANALYTICS_FEATURE.DIFFICULT_WORDS, surface),
          ...UNKNOWN_FEATURE_PROVIDER,
          outcome: "success",
          target_language: latest.language.targetCode,
        })
      }
    } catch (error) {
      logger.error("[DifficultWords] Failed to start:", error)
    } finally {
      startingRef.current = false
    }
  })

  const setEnabled = useEffectEvent(
    async (enabled: boolean, surface: DifficultWordsSurface | null) => {
      if (enabled) await enable(surface)
      else disable()
    },
  )

  const toggleFromShortcut = useEffectEvent(() => {
    void setEnabled(!sessionRef.current, ANALYTICS_SURFACE.SHORTCUT)
  })

  const applyLemmaChange = useEffectEvent(
    (change: Parameters<DifficultWordsSession["applyLemmaChange"]>[0]) => {
      sessionRef.current?.applyLemmaChange(change)
    },
  )

  useEffect(() => {
    const uninstall = difficultWordsTab.install((enabled, surface) => {
      void setEnabled(enabled, surface)
    })
    const removeListeners = [
      onMessage("getDifficultWordsState", () => difficultWordsTab.getState()),
      onMessage("setDifficultWordsEnabled", async (message) => {
        await setEnabled(message.data.enabled, ANALYTICS_SURFACE.POPUP)
        return difficultWordsTab.getState()
      }),
      onMessage("difficultWordLemmaChanged", (message) => {
        applyLemmaChange(message.data)
      }),
    ]
    const unsubscribeLookups = onSelectionLookup((lookup) => {
      if (lookup) sessionRef.current?.onSelectionLookup(lookup)
    })
    return () => {
      uninstall()
      for (const remove of removeListeners) remove()
      unsubscribeLookups()
      disable()
    }
  }, [])

  // Switched off in settings: the marks go with it.
  useEffect(() => {
    if (!difficultWordsConfig.enabled) disable()
  }, [difficultWordsConfig.enabled])

  // The key is taken from the page only for an account that can use it: the
  // verdict is cached for every tab, and the floating button asks it too.
  const access = useDifficultWordsAccess(difficultWordsConfig.enabled)
  const shortcut =
    difficultWordsConfig.enabled && (access.data === "allowed" || access.data === "unknown")
      ? getDifficultWordsShortcut(difficultWordsConfig)
      : ""
  useEffect(() => {
    if (isShortcutEmpty(shortcut) || !isValidShortcut(shortcut)) return undefined
    const registration = HotkeyManager.getInstance().register(
      shortcut as HotkeyChord,
      () => toggleFromShortcut(),
      { ignoreInputs: true, preventDefault: true, stopPropagation: true },
    )
    return () => registration.unregister()
  }, [shortcut])

  if (!session) return null

  return (
    <>
      <DifficultWordCard
        open={view.card !== null}
        anchor={view.card?.anchor ?? null}
        mountKey={view.card?.key ?? 0}
        onClose={session.closeCard}
        onKnown={session.markCardKnown}
        onSave={session.onCardSave}
        isOverMark={session.isOverMark}
      />
      {view.check && (
        <KnownCheck
          rect={view.check.rect}
          onPress={session.markCheckKnown}
          onPointerEnter={session.checkPointerEnter}
          onPointerLeave={session.checkPointerLeave}
        />
      )}
      {view.levelLang && (
        <LevelPicker
          key={view.levelLang}
          lang={view.levelLang}
          onPick={session.pickLevel}
          onDismiss={session.dismissLevel}
        />
      )}
    </>
  )
}
