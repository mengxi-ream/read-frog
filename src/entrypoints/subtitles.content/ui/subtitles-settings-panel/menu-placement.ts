// An iframe player stacks its controls above everything inside it, so a menu over the
// video can be seen but not clicked; there the menu lives in the controls with the button.
export function isMenuInControls(embedded: boolean | undefined): boolean {
  return !!embedded && window.self !== window.top
}

export const MENU_EDGE_MARGIN = 16

interface Span {
  left: number
  width: number
}

export function clampMenuLeft(left: number, boxWidth: number, menuWidth: number): number {
  return Math.max(MENU_EDGE_MARGIN, Math.min(left, boxWidth - menuWidth - MENU_EDGE_MARGIN))
}

// The button renders in its own shadow root, so its row is the one holding that root's host.
export function getControlsRow(button: Element): Element | null {
  const root = button.getRootNode()
  return root instanceof ShadowRoot ? root.host.parentElement : button.parentElement
}

export function getMenuLeft(button: Span, box: Span, menuWidth: number): number {
  const leftAligned = button.left - box.left
  const fitsRightward = leftAligned + menuWidth <= box.width - MENU_EDGE_MARGIN
  const left = fitsRightward ? leftAligned : leftAligned + button.width - menuWidth
  return clampMenuLeft(left, box.width, menuWidth)
}
