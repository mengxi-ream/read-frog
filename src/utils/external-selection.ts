import {
  EXTERNAL_SELECTION_CLEAR_EVENT,
  EXTERNAL_SELECTION_OPEN_EVENT,
} from "@/utils/constants/selection"

export type ExternalSelectionDirection = "top-left" | "top-right" | "bottom-left" | "bottom-right"

export interface ExternalSelectionRequest {
  text: string
  contextParagraphs: string[]
  rect: { top: number; left: number; width: number; height: number }
  anchor: { x: number; y: number }
  direction: ExternalSelectionDirection
}

export function openExternalSelection(request: ExternalSelectionRequest) {
  window.dispatchEvent(
    new CustomEvent<ExternalSelectionRequest>(EXTERNAL_SELECTION_OPEN_EVENT, { detail: request }),
  )
}

export function clearExternalSelection() {
  window.dispatchEvent(new CustomEvent(EXTERNAL_SELECTION_CLEAR_EVENT))
}
