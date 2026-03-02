import { atom } from "jotai"

export const selectionContentAtom = atom<string | null>(null)
export const selectionRangeAtom = atom<Range | null>(null)
export const isSelectionToolbarVisibleAtom = atom<boolean>(false)

export const isTranslatePopoverVisibleAtom = atom<boolean>(false)
export const isAiPopoverVisibleAtom = atom<boolean>(false)
export const isCustomFeaturePopoverVisibleAtom = atom<boolean>(false)
export const activeCustomFeatureIdAtom = atom<string | null>(null)

export const mouseClickPositionAtom = atom<{ x: number, y: number } | null>(null)
