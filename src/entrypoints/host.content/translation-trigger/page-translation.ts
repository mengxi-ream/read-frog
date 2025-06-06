import { isDontWalkIntoElement, isHTMLElement, isIFrameElement } from '@/utils/host/dom/filter'
import { deepQueryTopLevelSelector, translateWalkedElement, walkAndLabelElement } from '@/utils/host/dom/traversal'
import { removeAllTranslatedWrapperNodes } from '@/utils/host/translate/node-manipulation'
import { sendMessage } from '@/utils/message'

// export function registerPageTranslationTriggers() {
//   // Four-finger touch gesture to trigger translatePage
//   let touchStartTime = 0
//   let fourFingerTouchStarted = false
//   let initialTouchPositions: Array<{ x: number, y: number }> = []

//   document.addEventListener('touchstart', (e) => {
//     if (e.touches.length === 4) {
//       fourFingerTouchStarted = true
//       touchStartTime = Date.now()
//       // 记录初始触摸位置
//       initialTouchPositions = Array.from(e.touches).map(touch => ({
//         x: touch.clientX,
//         y: touch.clientY,
//       }))
//     }
//     else {
//       fourFingerTouchStarted = false
//       initialTouchPositions = []
//     }
//   }, { passive: true })

//   document.addEventListener('touchend', (e) => {
//     // Check if this was a four-finger tap (short duration touch)
//     if (fourFingerTouchStarted && e.touches.length === 0) {
//       const touchDuration = Date.now() - touchStartTime
//       // Consider it a tap if touch duration is less than 500ms
//       if (touchDuration < 500) {
//         translatePage()
//       }
//       fourFingerTouchStarted = false
//       initialTouchPositions = []
//     }
//   }, { passive: true })

//   document.addEventListener('touchmove', (e) => {
//     // Cancel four-finger gesture if fingers move too much or finger count changes
//     if (!fourFingerTouchStarted)
//       return

//     // 检查手指数量是否改变
//     if (e.touches.length !== 4) {
//       fourFingerTouchStarted = false
//       initialTouchPositions = []
//       return
//     }

//     // 检查移动距离是否超过阈值（允许一定的移动容差）
//     const MOVE_THRESHOLD = 30 // 30px 的移动阈值
//     let hasMoveExceedThreshold = false

//     for (let i = 0; i < Math.min(e.touches.length, initialTouchPositions.length); i++) {
//       const currentTouch = e.touches[i]
//       const initialPos = initialTouchPositions[i]
//       const deltaX = Math.abs(currentTouch.clientX - initialPos.x)
//       const deltaY = Math.abs(currentTouch.clientY - initialPos.y)
//       const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

//       if (distance > MOVE_THRESHOLD) {
//         hasMoveExceedThreshold = true
//         break
//       }
//     }

//     if (hasMoveExceedThreshold) {
//       fourFingerTouchStarted = false
//       initialTouchPositions = []
//     }
//   }, { passive: true })
// }

const MAX_DURATION = 500
const MOVE_THRESHOLD2 = 30 * 30

export class PageTranslationManager {
  private isAutoTranslated: boolean = false
  private intersectionObserver: IntersectionObserver | null = null
  private mutationObservers: MutationObserver[] = []
  private id: string | null = null
  private options: IntersectionObserverInit
  private dontWalkIntoElementsCache = new WeakSet<HTMLElement>()

  constructor(options: IntersectionObserverInit = { root: null, rootMargin: '0px', threshold: 0.1 }) {
    this.options = options
    this.registerPageTranslationTriggers()
  }

  get isActive(): boolean {
    return this.isAutoTranslated
  }

  start(): void {
    if (this.isAutoTranslated) {
      console.warn('AutoTranslationManager is already active')
      return
    }

    this.id = crypto.randomUUID()
    this.isAutoTranslated = true

    sendMessage('setEnablePageTranslationOnContentScript', {
      enabled: true,
    })

    // Listen to existing elements when they enter the viewpoint
    this.intersectionObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (isHTMLElement(entry.target)) {
            translateWalkedElement(entry.target, this.id!)
          }
          observer.unobserve(entry.target)
        }
      })
    }, this.options)

    // Initialize walkability state for existing elements
    this.addDontWalkIntoElements(document.body)
    this.observerTopLevelParagraphs(document.body)

    // Start observing mutations from document.body and all shadow roots
    this.observeMutations(document.body)
  }

  stop(): void {
    if (!this.isAutoTranslated) {
      return
    }

    this.isAutoTranslated = false

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect()
      this.intersectionObserver = null
    }

    // Disconnect all mutation observers
    this.mutationObservers.forEach(observer => observer.disconnect())
    this.mutationObservers = []

    this.dontWalkIntoElementsCache = new WeakSet()

    removeAllTranslatedWrapperNodes()

    this.id = null

    sendMessage('setEnablePageTranslationOnContentScript', {
      enabled: false,
    })
  }

  private observerTopLevelParagraphs(container: HTMLElement): void {
    const observer = this.intersectionObserver
    if (!this.id || !observer)
      return

    walkAndLabelElement(container, this.id)
    // if container itself has paragraph and the id
    if (container.hasAttribute('data-read-frog-paragraph') && container.getAttribute('data-read-frog-walked') === this.id) {
      observer.observe(container)
      return
    }

    const paragraphs = this.collectParagraphElementsDeep(container, this.id)
    const topLevelParagraphs = paragraphs.filter((el) => {
      const ancestor = el.parentElement?.closest('[data-read-frog-paragraph]')
      // keep it if either:
      //  • no paragraph ancestor at all, or
      //  • the ancestor is *not* inside container
      return !ancestor || !container.contains(ancestor)
    })
    topLevelParagraphs.forEach(el => observer.observe(el))
  }

  /**
   * Recursively collect elements with paragraph attributes from shadow roots and iframes
   */
  private collectParagraphElementsDeep(container: HTMLElement, walkId: string): HTMLElement[] {
    const result: HTMLElement[] = []

    const collectFromContainer = (root: HTMLElement | Document | ShadowRoot) => {
      const elements = root.querySelectorAll<HTMLElement>(`[data-read-frog-paragraph][data-read-frog-walked="${CSS.escape(walkId)}"]`)
      result.push(...Array.from(elements))
    }

    const traverseElement = (element: HTMLElement) => {
      if (element.shadowRoot) {
        collectFromContainer(element.shadowRoot)
        for (const child of element.shadowRoot.children) {
          if (child instanceof HTMLElement) {
            traverseElement(child)
          }
        }
      }

      if (isIFrameElement(element)) {
        const iframeDocument = element.contentDocument
        if (iframeDocument && iframeDocument.body) {
          collectFromContainer(iframeDocument)
          traverseElement(iframeDocument.body)
        }
      }

      for (const child of element.children) {
        if (child instanceof HTMLElement) {
          traverseElement(child)
        }
      }
    }

    collectFromContainer(container)
    traverseElement(container)

    return result
  }

  private registerPageTranslationTriggers() {
    let startTime = 0
    let startTouches: TouchList | null = null

    const reset = () => {
      startTime = 0
      startTouches = null
    }

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 4) {
        startTime = performance.now()
        startTouches = e.touches
      }
      else {
        reset()
      }
    }

    const onMove = (e: TouchEvent) => {
      if (!startTouches)
        return
      if (e.touches.length !== 4)
        return reset()

      for (let i = 0; i < 4; i++) {
        const dx = e.touches[i].clientX - startTouches[i].clientX
        const dy = e.touches[i].clientY - startTouches[i].clientY
        if (dx * dx + dy * dy > MOVE_THRESHOLD2)
          return reset()
      }
    }

    const onEnd = () => {
      if (!startTouches)
        return
      if (performance.now() - startTime < MAX_DURATION)
        this.isAutoTranslated ? this.stop() : this.start()
      reset()
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('touchend', onEnd, { passive: true })
    document.addEventListener('touchcancel', reset, { passive: true })

    // 供调用方卸载
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', reset)
    }
  }

  /**
   * Handle style/class attribute changes and only trigger observation
   * when element transitions from "don't walk into" to "walkable"
   */
  private handleElementWalkabilityChange(element: HTMLElement): void {
    const wasDontWalkInto = this.dontWalkIntoElementsCache.has(element)
    const isDontWalkIntoNow = isDontWalkIntoElement(element)

    // Update cache with current state
    if (isDontWalkIntoNow) {
      this.dontWalkIntoElementsCache.add(element)
    }
    else {
      this.dontWalkIntoElementsCache.delete(element)
    }

    // Only trigger observation if element transitioned from "don't walk into" to "walkable"
    // wasDontWalkInto === true means it was previously not walkable
    // isDontWalkIntoNow === false means it's now walkable
    if (wasDontWalkInto === true && isDontWalkIntoNow === false) {
      this.observerTopLevelParagraphs(element)
    }
  }

  /**
   * Initialize walkability state for an element and its descendants
   */
  private addDontWalkIntoElements(element: HTMLElement): void {
    const dontWalkIntoElements = deepQueryTopLevelSelector(element, isDontWalkIntoElement)
    dontWalkIntoElements.forEach(el => this.dontWalkIntoElementsCache.add(el))
  }

  /**
   * Start observing mutations for a container and all its shadow roots
   */
  private observeMutations(container: HTMLElement): void {
    const mutationObserver = new MutationObserver((records) => {
      for (const rec of records) {
        if (rec.type === 'childList') {
          rec.addedNodes.forEach((node) => {
            if (isHTMLElement(node)) {
              this.addDontWalkIntoElements(node)
              this.observerTopLevelParagraphs(node)
              this.observeIsolatedDescendantsMutations(node)
            }
          })
        }
        else if (
          rec.type === 'attributes'
          && (rec.attributeName === 'style' || rec.attributeName === 'class')
        ) {
          const el = rec.target
          if (isHTMLElement(el)) {
            this.handleElementWalkabilityChange(el)
          }
        }
      }
    })

    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    })

    this.mutationObservers.push(mutationObserver)
    this.observeIsolatedDescendantsMutations(container)
  }

  /**
   * Recursively find and observe shadow roots and iframes in an element and its descendants
   * These can't be find as top level paragraph elements because isolated shadow roots and iframes are not
   * considered as part of the document.
   */
  private observeIsolatedDescendantsMutations(element: HTMLElement): void {
    // Check if this element has a shadow root
    if (element.shadowRoot) {
      for (const child of element.shadowRoot.children) {
        if (isHTMLElement(child)) {
          this.observeMutations(child)
        }
      }
    }

    // Check iframes
    if (isIFrameElement(element)) {
      const iframeDocument = element.contentDocument
      if (iframeDocument && iframeDocument.body) {
        this.observeMutations(iframeDocument.body)
      }
    }

    // Recursively check children
    for (const child of element.children) {
      if (isHTMLElement(child)) {
        this.observeIsolatedDescendantsMutations(child)
      }
    }
  }
}
