import { atom } from "jotai"

export const selectionContentAtom = atom<string | null>(null)
export const selectionRangeAtom = atom<Range | null>(null)
export const isSelectionToolbarVisibleAtom = atom<boolean>(false)
