import type { CustomActionRequest } from "@/components/custom-action/atoms"
import { atom } from "jotai"

/**
 * The card of a clicked difficult word. Its own atom, not the one the
 * selection toolbar's action card reads: both cards live in this UI's store,
 * and sharing one would open the toolbar's card beside this one.
 */
export const difficultWordRequestAtom = atom<CustomActionRequest | null>(null)
