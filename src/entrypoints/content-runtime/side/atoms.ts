import { atom, createStore } from "jotai"
import { createTranslationStateAtomForContentScript } from "@/utils/atoms/translation-state"

export const store = createStore()

export const isSideOpenAtom = atom(false)

export const isDraggingButtonAtom = atom(false)

/**
 * Hidden from its close menu until the page reloads. Kept in memory on purpose:
 * it changes no setting, and a reload or a new tab brings the button back.
 */
export const isFloatingButtonHiddenUntilReloadAtom = atom(false)

export const enablePageTranslationAtom = createTranslationStateAtomForContentScript({
  enabled: false,
})
