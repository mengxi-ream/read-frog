import { globalConfig } from '@/utils/config/config'
import { CONTENT_WRAPPER_CLASS } from '@/utils/constants/dom-labels'
import { isDontWalkIntoButTranslateAsChildElement, isHTMLElement, isIFrameElement } from '@/utils/host/dom/filter'
import { deepQueryTopLevelSelector } from '@/utils/host/dom/find'
import { walkAndLabelElement } from '@/utils/host/dom/traversal'
import { removeAllTranslatedWrapperNodes, translateWalkedElement } from '@/utils/host/translate/node-manipulation'
import { sendMessage } from '@/utils/message'

type SimpleIntersectionOptions = Omit<IntersectionObserverInit, 'threshold'> & {
  threshold?: number
}

interface IPageTranslationManager {
  /**
   * Indicates whether the page translation is currently active
   */
  readonly isActive: boolean

  /**
   * Starts the automatic page translation functionality
   * Registers observers, touch triggers and set storage
   */
  start: () => void

  /**
   * Stops the automatic page translation functionality
   * Cleans up all observers and removes translated content and set storage
   */
  stop: () => void

  /**
   * Registers page translation triggers
   */
  registerPageTranslationTriggers: () => () => void
}

export class PageTranslationManager implements IPageTranslationManager {
  private static readonly MAX_DURATION = 500
  private static readonly MOVE_THRESHOLD = 30 * 30
  private static readonly DEFAULT_INTERSECTION_OPTIONS: SimpleIntersectionOptions = {
    root: null,
    rootMargin: '600px',
    threshold: 0.1,
  }

  private isAutoTranslating: boolean = false
  private intersectionObserver: IntersectionObserver | null = null
  private mutationObservers: MutationObserver[] = []
  private walkId: string | null = null
  private intersectionOptions: IntersectionObserverInit
  private dontWalkIntoElementsCache = new WeakSet<HTMLElement>()

  constructor(intersectionOptions: SimpleIntersectionOptions = {}) {
    if (intersectionOptions.threshold !== undefined) {
      if (intersectionOptions.threshold < 0 || intersectionOptions.threshold > 1) {
        throw new Error('IntersectionObserver threshold must be between 0 and 1')
      }
    }

    this.intersectionOptions = {
      ...PageTranslationManager.DEFAULT_INTERSECTION_OPTIONS,
      ...intersectionOptions,
    }
  }

  get isActive(): boolean {
    return this.isAutoTranslating
  }

  start(): void {
    if (!globalConfig) {
      console.warn('Global config is not initialized')
      return
    }

    if (this.isAutoTranslating) {
      console.warn('AutoTranslationManager is already active')
      return
    }

    this.isAutoTranslating = true
    sendMessage('setEnablePageTranslationOnContentScript', {
      enabled: true,
    })

    // Listen to existing elements when they enter the viewpoint
    const walkId = crypto.randomUUID()
    this.walkId = walkId
    this.intersectionObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (isHTMLElement(entry.target)) {
            if (!globalConfig) {
              console.warn('Global config is not initialized')
              return
            }
            if (!entry.target.closest(`.${CONTENT_WRAPPER_CLASS}`)) {
              translateWalkedElement(entry.target, walkId, globalConfig.translate.mode)
            }
          }
          observer.unobserve(entry.target)
        }
      })
    }, this.intersectionOptions)

    // Initialize walkability state for existing elements
    this.addDontWalkIntoElements(document.body)
    this.observerTopLevelParagraphs(document.body)

    // Start observing mutations from document.body and all shadow roots
    this.observeMutations(document.body)
  }

  stop(): void {
    if (!this.isAutoTranslating) {
      console.warn('AutoTranslationManager is already inactive')
      return
    }

    this.isAutoTranslating = false
    this.walkId = null
    this.dontWalkIntoElementsCache = new WeakSet()

    sendMessage('setEnablePageTranslationOnContentScript', {
      enabled: false,
    })

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect()
      this.intersectionObserver = null
    }
    this.mutationObservers.forEach(observer => observer.disconnect())
    this.mutationObservers = []

    removeAllTranslatedWrapperNodes()
  }

  registerPageTranslationTriggers(): () => void {
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
        if (dx * dx + dy * dy > PageTranslationManager.MOVE_THRESHOLD)
          return reset()
      }
    }

    const onEnd = () => {
      if (!startTouches)
        return
      if (performance.now() - startTime < PageTranslationManager.MAX_DURATION)
        this.isAutoTranslating ? this.stop() : this.start()
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

  private observerTopLevelParagraphs(container: HTMLElement): void {
    const observer = this.intersectionObserver
    if (!this.walkId || !observer)
      return

    walkAndLabelElement(container, this.walkId)
    // if container itself has paragraph and the id
    if (container.hasAttribute('data-read-frog-paragraph') && container.getAttribute('data-read-frog-walked') === this.walkId) {
      observer.observe(container)
      return
    }

    const paragraphs = this.collectParagraphElementsDeep(container, this.walkId)
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

  /**
   * Handle style/class attribute changes and only trigger observation
   * when element transitions from "don't walk into" to "walkable"
   */
  private didChangeToWalkable(element: HTMLElement): boolean {
    const wasDontWalkInto = this.dontWalkIntoElementsCache.has(element)
    const isDontWalkIntoNow = isDontWalkIntoButTranslateAsChildElement(element)

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
    return wasDontWalkInto === true && isDontWalkIntoNow === false
  }

  /**
   * Initialize walkability state for an element and its descendants
   */
  private addDontWalkIntoElements(element: HTMLElement): void {
    const dontWalkIntoElements = deepQueryTopLevelSelector(element, isDontWalkIntoButTranslateAsChildElement)
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
          if (isHTMLElement(el) && this.didChangeToWalkable(el)) {
            this.observerTopLevelParagraphs(el)
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
