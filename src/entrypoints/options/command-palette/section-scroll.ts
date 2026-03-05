import { waitForElement } from "@/utils/dom/wait-for-element"

export const SECTION_QUERY_PARAM = "section"

export function buildSectionSearch(sectionId: string): string {
  const params = new URLSearchParams()
  params.set(SECTION_QUERY_PARAM, sectionId)
  return `?${params.toString()}`
}

export function getSectionIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search)
  const sectionId = params.get(SECTION_QUERY_PARAM)
  if (!sectionId) {
    return null
  }

  const trimmedSectionId = sectionId.trim()
  return trimmedSectionId.length > 0 ? trimmedSectionId : null
}

export async function scrollToSectionWhenReady(sectionId: string): Promise<boolean> {
  const existingElement = document.getElementById(sectionId)
  if (existingElement) {
    existingElement.scrollIntoView({ behavior: "smooth", block: "start" })
    return true
  }

  const delayedElement = await waitForElement(buildIdSelector(sectionId))
  if (!delayedElement) {
    return false
  }

  delayedElement.scrollIntoView({ behavior: "smooth", block: "start" })
  return true
}

function buildIdSelector(sectionId: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return `#${CSS.escape(sectionId)}`
  }

  const escapedSectionId = sectionId
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"")
  return `[id="${escapedSectionId}"]`
}
