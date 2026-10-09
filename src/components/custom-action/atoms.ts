import type { SurfaceByFeature } from "@/types/analytics"
import { atom } from "jotai"

export interface CustomActionRequest {
  actionId: string
  selectionText: string
  contextText: string
  surface: SurfaceByFeature["custom_ai_action"]
  sessionKey: number
  rerunNonce: number
}

export const customActionRequestAtom = atom<CustomActionRequest | null>(null)

export const rerunCustomActionAtom = atom(null, (get, set) => {
  const request = get(customActionRequestAtom)
  if (!request) {
    return
  }

  set(customActionRequestAtom, { ...request, rerunNonce: request.rerunNonce + 1 })
})
