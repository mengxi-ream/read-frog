const WAIT_TIMEOUT = 10000

export function waitForElement(
  selector: string,
  validate?: (element: Element) => boolean,
): Promise<Element | null> {
  return new Promise((resolve) => {
    let settled = false
    let observer: MutationObserver | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const finish = (element: Element | null) => {
      if (settled) {
        return
      }

      settled = true
      observer?.disconnect()
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
      resolve(element)
    }

    const tryFind = () => {
      const element = document.querySelector(selector)
      if (element && (!validate || validate(element))) {
        return element
      }
      return null
    }

    const found = tryFind()
    if (found) {
      finish(found)
      return
    }

    const root = document.body ?? document.documentElement
    if (!root) {
      finish(null)
      return
    }

    observer = new MutationObserver(() => {
      const found = tryFind()
      if (found) {
        finish(found)
      }
    })

    observer.observe(root, {
      childList: true,
      subtree: true,
    })

    timeoutId = setTimeout(() => {
      finish(null)
    }, WAIT_TIMEOUT)
  })
}
