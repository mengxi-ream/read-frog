import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"

// WXT prepends `:host { all: initial !important }` inside each isolated UI.
// These declarations must live in the same Shadow DOM cascade (and after that
// reset) to restore WXT's intended zero-sized overlay geometry.
export const OVERLAY_SHADOW_ROOT_CSS = `
:host {
  display: block !important;
  height: 0 !important;
  overflow: visible !important;
  position: relative !important;
  width: 0 !important;
}

body {
  background-color: transparent !important;
}
`

export function insertShadowRootUIWrapperInto(container: HTMLElement, shadowHost: HTMLElement) {
  shadowHost.classList.add(NOTRANSLATE_CLASS)

  const wrapper = document.createElement("div")
  wrapper.className = `text-base antialiased font-sans text-foreground z-[2147483647] ${NOTRANSLATE_CLASS}`
  container.append(wrapper)

  return wrapper
}
