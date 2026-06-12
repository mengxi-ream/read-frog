import type { Hotkey } from "@tanstack/hotkeys"
import { HotkeyManager } from "@tanstack/hotkeys"
import { useAtomValue, useSetAtom } from "jotai"
import { useEffect } from "react"
import FrogToast from "@/components/frog-toast"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_SIDE_PANEL_TRANSLATION_SHORTCUT_KEY } from "@/utils/constants/translate"
import { onMessage } from "@/utils/message"
import { isPageTranslationShortcutEmpty, isValidConfiguredPageTranslationShortcut } from "@/utils/page-translation-shortcut"
import { hasLoadedTranslationHubAtom, isSideOpenAtom } from "./atoms"
import FloatingButton from "./components/floating-button"
import TranslationHubSidePanel from "./components/translation-hub-side-panel"
import { openTranslationHubSidePanel } from "./utils/translation-hub-panel"

export default function App() {
  const setIsSideOpen = useSetAtom(isSideOpenAtom)
  const setHasLoadedTranslationHub = useSetAtom(hasLoadedTranslationHubAtom)
  const translateConfig = useAtomValue(configFieldsAtomMap.translate)

  useEffect(() => {
    return onMessage("openTranslationHubSidePanel", () => {
      openTranslationHubSidePanel({
        setHasLoadedTranslationHub,
        setIsSideOpen,
        splitPanelMode: translateConfig.page.splitPanelMode,
      })
    })
  }, [setHasLoadedTranslationHub, setIsSideOpen, translateConfig.page.splitPanelMode])

  useEffect(() => {
    if (import.meta.env.FIREFOX && translateConfig.page.splitPanelMode === "sideAPI") {
      return () => {}
    }

    const shortcut = translateConfig.page.sidePanelShortcut ?? DEFAULT_SIDE_PANEL_TRANSLATION_SHORTCUT_KEY
    if (isPageTranslationShortcutEmpty(shortcut) || !isValidConfiguredPageTranslationShortcut(shortcut)) {
      return () => {}
    }

    const registration = HotkeyManager.getInstance().register(
      shortcut as Hotkey,
      () => {
        openTranslationHubSidePanel({
          setHasLoadedTranslationHub,
          setIsSideOpen,
          splitPanelMode: translateConfig.page.splitPanelMode,
        })
      },
      {
        ignoreInputs: true,
        preventDefault: true,
        stopPropagation: true,
      },
    )

    return () => {
      registration.unregister()
    }
  }, [setHasLoadedTranslationHub, setIsSideOpen, translateConfig.page.sidePanelShortcut, translateConfig.page.splitPanelMode])

  return (
    <>
      <FloatingButton />
      <TranslationHubSidePanel />
      <FrogToast />
    </>
  )
}
