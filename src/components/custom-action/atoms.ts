import type { NoteOriginInput } from "@read-frog/definitions"
import type { SurfaceByFeature } from "@/types/analytics"
import { atom } from "jotai"

export interface CustomActionRequest {
  actionId: string
  /** The text as selected: shown in the card, copied and read aloud. */
  selectionText: string
  /** The selection the action runs on, without stray whitespace or zero-width characters. */
  cleanSelection: string
  contextText: string
  surface: SurfaceByFeature["custom_ai_action"]
  /**
   * Where the text came from, recorded with each note saved from the card;
   * read when the card opens. Null when the note gets no origin.
   */
  noteOrigin: NoteOriginInput | null
  sessionKey: number
  rerunNonce: number
}

export const customActionRequestAtom = atom<CustomActionRequest | null>(null)
