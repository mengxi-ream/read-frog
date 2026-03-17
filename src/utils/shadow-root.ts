import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"

export function insertShadowRootUIWrapperInto(container: HTMLElement) {
  const wrapper = document.createElement("div")
  wrapper.className = `text-base antialiased font-sans text-foreground z-[2147483647] ${NOTRANSLATE_CLASS}`
  container.append(wrapper)

  return wrapper
}
