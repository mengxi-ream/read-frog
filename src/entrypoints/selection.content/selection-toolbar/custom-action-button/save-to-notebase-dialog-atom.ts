import type {
  SelectionToolbarCustomAction,
  SelectionToolbarCustomActionNotebaseAccount,
} from "@/types/config/selection-toolbar"
import type {
  PendingConnectedNotebaseSave,
  PendingCreateNotebaseSave,
} from "@/utils/notebase/pending-save"
import { atom } from "jotai"

export type SaveToNotebaseAnalyticsSource = "save_suggestion"

export type SaveToNotebaseDialogState =
  | { open: false }
  | {
      open: true
      mode: "create_or_connect"
      pendingNotebaseSave: PendingCreateNotebaseSave
      /**
       * Present when the action does not exist in config yet (save suggestion
       * flow). It is appended to config at dialog confirm — the "real action
       * button" moment. Invariant: pendingActionDraft.id === pendingNotebaseSave.actionId.
       */
      pendingActionDraft?: SelectionToolbarCustomAction
      analyticsSource?: SaveToNotebaseAnalyticsSource
    }
  | {
      open: true
      mode: "connected_login_required"
      pendingNotebaseSave: PendingConnectedNotebaseSave
      connectedAccount: SelectionToolbarCustomActionNotebaseAccount
      analyticsSource?: SaveToNotebaseAnalyticsSource
    }
  | {
      open: true
      mode: "foreign_connection"
      pendingNotebaseSave: PendingCreateNotebaseSave
      connectedAccount: SelectionToolbarCustomActionNotebaseAccount
      analyticsSource?: SaveToNotebaseAnalyticsSource
    }

export const saveToNotebaseDialogAtom = atom<SaveToNotebaseDialogState>({ open: false })

export const isSaveToNotebaseDialogOpenAtom = atom((get) => get(saveToNotebaseDialogAtom).open)
