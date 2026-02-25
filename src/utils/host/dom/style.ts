/**
 * Smash the truncation style of the node if it has truncation style
 * @param element - The node to smash the truncation style
 */
export function smashTruncationStyle(element: HTMLElement) {
  // Ensure we're in a window context
  if (typeof window === "undefined") {
    return
  }

  // Use a wrapper function to ensure proper `this` binding
  const scheduleIdleTask = (callback: () => void) => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(callback)
    }
    else if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(callback)
    }
    else {
      setTimeout(callback, 0)
    }
  }

  scheduleIdleTask(() => {
    const computedStyle = window.getComputedStyle(element)

    if (computedStyle.webkitLineClamp && computedStyle.webkitLineClamp !== "none") {
      element.style.webkitLineClamp = "unset"
    }

    if (computedStyle.maxHeight && computedStyle.maxHeight !== "none") {
      element.style.maxHeight = "unset"
    }

    // fix this issue: https://github.com/mengxi-ream/read-frog/issues/222
    // if (computedStyle.overflow === 'hidden') {
    //   element.style.overflow = 'visible'
    // }

    if (computedStyle.textOverflow === "ellipsis") {
      element.style.textOverflow = "unset"
    }
  })
}
