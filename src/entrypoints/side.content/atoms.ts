import { atom, createStore } from "jotai"
import { createTranslationStateAtomForContentScript } from "@/utils/atoms/translation-state"

export const store = createStore()

export const isSideOpenAtom = atom(false)

export const isDraggingButtonAtom = atom(false)

export const enablePageTranslationAtom = createTranslationStateAtomForContentScript(
  { enabled: false },
)
