import type { SelectionToolbarCustomActionNotebaseAccount } from "@/types/config/selection-toolbar"
import type { PendingConnectedNotebaseSave, PendingCreateNotebaseSave } from "@/utils/notebase/pending-save"
import { atom } from "jotai"

export type SaveToNotebaseDialogState
  = | { open: false }
    | {
      open: true
      mode: "create_or_connect"
      pendingNotebaseSave: PendingCreateNotebaseSave
    }
    | {
      open: true
      mode: "connected_login_required"
      pendingNotebaseSave: PendingConnectedNotebaseSave
      connectedAccount: SelectionToolbarCustomActionNotebaseAccount
    }
    | {
      open: true
      mode: "foreign_connection"
      pendingNotebaseSave: PendingCreateNotebaseSave
      connectedAccount: SelectionToolbarCustomActionNotebaseAccount
    }

export const saveToNotebaseDialogAtom = atom<SaveToNotebaseDialogState>({ open: false })

export const isSaveToNotebaseDialogOpenAtom = atom(get => get(saveToNotebaseDialogAtom).open)
