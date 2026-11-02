import { atom } from "jotai"

/**
 * Annotation mode: every selection on the page is annotated as it is made,
 * and the toolbar stays out of the way. This tab's, in memory: a reload
 * leaves it, and the pill at the bottom of the page shows it is on.
 */
export const annotationModeAtom = atom(false)
