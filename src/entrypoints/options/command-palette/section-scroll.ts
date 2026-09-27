import { waitForElement } from "@/utils/dom/wait-for-element"
import { SECTION_QUERY_PARAM } from "@/utils/navigation"

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
    await revealAndScroll(existingElement)
    return true
  }

  const delayedElement = await waitForElement(buildIdSelector(sectionId))
  if (!delayedElement) {
    return false
  }

  await revealAndScroll(delayedElement)
  return true
}

async function revealAndScroll(element: Element) {
  if (activateEnclosingTabs(element)) {
    // Let the newly shown panel lay out before measuring where to scroll.
    await nextFrame()
  }
  element.scrollIntoView({ behavior: "smooth", block: "start" })
}

/**
 * A section can sit in a tab panel that is kept mounted but hidden (`hidden` + `inert`), or be a
 * tab itself. Click the tab of each hidden panel around it, outermost first, and the element itself
 * when it is an unselected tab. Returns whether anything was clicked.
 */
function activateEnclosingTabs(element: Element): boolean {
  const hiddenPanels: Element[] = []
  for (
    let panel = element.closest('[role="tabpanel"]');
    panel;
    panel = panel.parentElement?.closest('[role="tabpanel"]') ?? null
  ) {
    if (isHiddenPanel(panel)) hiddenPanels.unshift(panel)
  }

  let activated = false
  for (const panel of hiddenPanels) {
    const trigger = findPanelTrigger(panel)
    if (trigger instanceof HTMLElement) {
      trigger.click()
      activated = true
    }
  }

  if (
    element instanceof HTMLElement &&
    element.getAttribute("role") === "tab" &&
    element.getAttribute("aria-selected") !== "true"
  ) {
    element.click()
    activated = true
  }
  return activated
}

function isHiddenPanel(panel: Element): boolean {
  return panel.hasAttribute("hidden") || panel.hasAttribute("inert")
}

function findPanelTrigger(panel: Element): Element | null {
  if (panel.id) {
    const trigger = document.querySelector(
      `[role="tab"][aria-controls="${escapeAttributeValue(panel.id)}"]`,
    )
    if (trigger) return trigger
  }
  const labelledBy = panel.getAttribute("aria-labelledby")
  const labelledTrigger = labelledBy ? document.getElementById(labelledBy) : null
  return labelledTrigger?.getAttribute("role") === "tab" ? labelledTrigger : null
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve())
    } else {
      setTimeout(resolve, 0)
    }
  })
}

function escapeAttributeValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')
}

function buildIdSelector(sectionId: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return `#${CSS.escape(sectionId)}`
  }

  return `[id="${escapeAttributeValue(sectionId)}"]`
}
