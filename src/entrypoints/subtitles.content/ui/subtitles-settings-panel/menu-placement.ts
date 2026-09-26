// An iframe player stacks its controls above everything inside it, so a menu over the
// video can be seen but not clicked; there the menu lives in the controls with the button.
export function isMenuInControls(embedded: boolean | undefined): boolean {
  return !!embedded && window.self !== window.top
}
