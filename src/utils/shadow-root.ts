import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"

// WXT prepends `:host { all: initial !important }` inside each isolated UI.
// These declarations must live after that reset to restore the zero-sized
// overlay geometry. Keep the host static so a host appended to the end of the
// page cannot become the containing block for absolutely positioned portals.
export const OVERLAY_SHADOW_ROOT_CSS = `
:host {
  display: block !important;
  height: 0 !important;
  overflow: visible !important;
  position: static !important;
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
