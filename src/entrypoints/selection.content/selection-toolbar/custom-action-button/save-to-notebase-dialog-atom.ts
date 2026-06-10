import type { PendingNotebaseSave } from "@/utils/notebase-pending-save"
import { atom } from "jotai"

export type SaveToNotebaseDialogState
  = | { open: false }
    | { open: true, pending: PendingNotebaseSave }

export const saveToNotebaseDialogAtom = atom<SaveToNotebaseDialogState>({ open: false })

export const isSaveToNotebaseDialogOpenAtom = atom(get => get(saveToNotebaseDialogAtom).open)
