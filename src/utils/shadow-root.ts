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
`

export function insertShadowRootUIWrapperInto(container: HTMLElement, shadowHost: HTMLElement) {
  shadowHost.classList.add(NOTRANSLATE_CLASS)

  const wrapper = document.createElement("div")
  wrapper.className = `text-base antialiased font-sans text-foreground z-[2147483647] ${NOTRANSLATE_CLASS}`
  container.append(wrapper)

  return wrapper
}

/**
 * Whether <body> renders. Reader modes such as SimpRead hide it with a class
 * that sets `display: none` and show their own copy of the article beside it,
 * under <html> (#2370).
 */
export function isBodyRendered(): boolean {
  const body = document.body
  return !!body && getComputedStyle(body).display !== "none"
}

/** Whether `node` is inside `container`, following shadow roots up to their hosts. */
function isWithin(node: Node, container: Node): boolean {
  for (let current: Node | null = node; current;) {
    if (current === container) return true
    current = current instanceof ShadowRoot ? current.host : current.parentNode
  }
  return false
}

/**
 * Keep an overlay host where the browser draws it, without remounting its UI,
 * so its React state survives.
 *
 * The host belongs in <body>, and goes into the new one when a client router
 * replaces <body>. While <body> does not render, the host waits under <html>
 * instead: nothing inside a `display: none` element is drawn, not even a fixed
 * shadow tree with the top z-index. It moves back once <body> renders again.
 *
 * A host placed deeper inside <body>, as the selection toolbar is in a page's
 * open modal <dialog> (possibly across shadow roots), is left where it is: its
 * placement belongs to whatever put it there.
 */
export function keepShadowHostRendered(shadowHost: HTMLElement): () => void {
  const observer = new MutationObserver(() => place())
  let observedBody: HTMLElement | null = null

  function place() {
    const body = document.body
    if (body && body !== observedBody) {
      observedBody = body
      observer.observe(body, { attributes: true, attributeFilter: ["class", "style", "hidden"] })
    }

    const parent = body && isBodyRendered() ? body : document.documentElement
    if (shadowHost.parentElement === parent) return
    if (body && shadowHost.parentElement !== body && isWithin(shadowHost, body)) return
    parent.append(shadowHost)
  }

  // Only <html>'s own children and the class or style of <html> and <body> can
  // hide <body> or swap it, so changes inside <body> never trigger this.
  observer.observe(document.documentElement, {
    childList: true,
    attributes: true,
    attributeFilter: ["class", "style"],
  })
  // A reader mode that opens on page load hides <body> before we mount.
  place()

  return () => observer.disconnect()
}
