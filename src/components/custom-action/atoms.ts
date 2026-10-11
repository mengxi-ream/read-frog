import type { SurfaceByFeature } from "@/types/analytics"
import { atom } from "jotai"

interface CustomActionRequest {
  actionId: string
  selectionText: string
  contextText: string
  surface: SurfaceByFeature["custom_ai_action"]
  sessionKey: number
  rerunNonce: number
}

export const customActionRequestAtom = atom<CustomActionRequest | null>(null)
