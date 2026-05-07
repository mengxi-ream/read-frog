import type { FeatureUsageContext } from "@/types/analytics"
import type { Config } from "@/types/config/config"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { isLLMProviderConfig } from "@/types/config/provider"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { getLocalConfig } from "@/utils/config/storage"
import { CONTENT_WRAPPER_CLASS } from "@/utils/constants/dom-labels"
import { resolveProviderConfig } from "@/utils/constants/feature-providers"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { hasNoWalkAncestor, isDontWalkIntoAndDontTranslateAsChildElement, isDontWalkIntoButTranslateAsChildElement, isHTMLElement } from "@/utils/host/dom/filter"
import { deepQueryTopLevelSelector } from "@/utils/host/dom/find"
import { walkAndLabelElement } from "@/utils/host/dom/traversal"
import { removeAllTranslatedWrapperNodes, translateWalkedElement } from "@/utils/host/translate/node-manipulation"
import { validateTranslationConfigAndToast } from "@/utils/host/translate/translate-text"
import { translateTextForPageTitle } from "@/utils/host/translate/translate-variants"
import { getOrCreateWebPageContext } from "@/utils/host/translate/webpage-context"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"

type SimpleIntersectionOptions = Omit<IntersectionObserverInit, "threshold"> & {
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
  start: (analyticsContext?: FeatureUsageContext) => Promise<void>

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
    rootMargin: "600px",
    threshold: 0.1,
  }

  private isPageTranslating: boolean = false
  private intersectionObserver: IntersectionObserver | null = null
  private mutationObservers: MutationObserver[] = []
  private walkId: string | null = null
  private intersectionOptions: IntersectionObserverInit
  private walkBlockedElementsCache = new WeakSet<HTMLElement>()
  private titleObserver: MutationObserver | null = null
  private lastSourceTitle: string | null = null
  private lastAppliedTranslatedTitle: string | null = null
  private titleRequestVersion = 0

  constructor(intersectionOptions: SimpleIntersectionOptions = {}) {
    if (intersectionOptions.threshold !== undefined) {
      if (intersectionOptions.threshold < 0 || intersectionOptions.threshold > 1) {
        throw new Error("IntersectionObserver threshold must be between 0 and 1")
      }
    }

    this.intersectionOptions = {
      ...PageTranslationManager.DEFAULT_INTERSECTION_OPTIONS,
      ...intersectionOptions,
    }
  }

  get isActive(): boolean {
    return this.isPageTranslating
  }

  async start(analyticsContext?: FeatureUsageContext): Promise<void> {
    if (this.isPageTranslating) {
      console.warn("PageTranslationManager is already active")
      return
    }

    const trackedContext = window === window.top ? analyticsContext : undefined

    const config = await getLocalConfig()
    if (!config) {
      console.warn("Config is not initialized")
      if (trackedContext) {
        void trackFeatureUsed({
          ...trackedContext,
          outcome: "failure",
        })
      }
      return
    }

    if (!validateTranslationConfigAndToast({
      providersConfig: config.providersConfig,
      translate: config.translate,
      language: config.language,
    })) {
      if (trackedContext) {
        void trackFeatureUsed({
          ...trackedContext,
          outcome: "failure",
        })
      }
      return
    }

    try {
      const providerConfig = resolveProviderConfig(config, "translate")

      await sendMessage("setAndNotifyPageTranslationStateChangedByManager", {
        enabled: true,
      })

      this.isPageTranslating = true
      await this.primeDocumentTitleContext(
        config.translate.enableAIContentAware && isLLMProviderConfig(providerConfig),
      )
      this.startDocumentTitleTracking()

      // Listen to existing elements when they enter the viewpoint
      const walkId = getRandomUUID()
      this.walkId = walkId
      this.intersectionObserver = new IntersectionObserver(async (entries, observer) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (isHTMLElement(entry.target)) {
              if (!entry.target.closest(`.${CONTENT_WRAPPER_CLASS}`)) {
                const currentConfig = await getLocalConfig()
                if (!currentConfig) {
                  logger.error("Global config is not initialized")
                  return
                }
                void translateWalkedElement(entry.target, walkId, currentConfig)
              }
            }
            observer.unobserve(entry.target)
          }
        }
      }, this.intersectionOptions)

      // Initialize walkability state for existing elements
      this.addWalkBlockedElements(document.body, config)
      await this.observerTopLevelParagraphs(document.body, config)

      // Start observing mutations from document.body and all shadow roots
      this.observeMutations(document.body)

      if (trackedContext) {
        void trackFeatureUsed({
          ...trackedContext,
          outcome: "success",
        })
      }
    }
    catch (error) {
      if (trackedContext) {
        void trackFeatureUsed({
          ...trackedContext,
          outcome: "failure",
        })
      }
      throw error
    }
  }

  stop(): void {
    if (!this.isPageTranslating) {
      console.warn("AutoTranslationManager is already inactive")
      return
    }

    void sendMessage("setAndNotifyPageTranslationStateChangedByManager", {
      enabled: false,
    })

    this.isPageTranslating = false
    this.walkId = null
    this.walkBlockedElementsCache = new WeakSet()
    this.stopDocumentTitleTracking()

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect()
      this.intersectionObserver = null
    }
    this.mutationObservers.forEach(observer => observer.disconnect())
    this.mutationObservers = []

    void removeAllTranslatedWrapperNodes()
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
      if (performance.now() - startTime < PageTranslationManager.MAX_DURATION) {
        this.isPageTranslating
          ? this.stop()
          : void this.start(createFeatureUsageContext(
            ANALYTICS_FEATURE.PAGE_TRANSLATION,
            ANALYTICS_SURFACE.TOUCH_GESTURE,
          ))
      }
      reset()
    }

    document.addEventListener("touchstart", onStart, { passive: true })
    document.addEventListener("touchmove", onMove, { passive: true })
    document.addEventListener("touchend", onEnd, { passive: true })
    document.addEventListener("touchcancel", reset, { passive: true })

    // 供调用方卸载
    return () => {
      document.removeEventListener("touchstart", onStart)
      document.removeEventListener("touchmove", onMove)
      document.removeEventListener("touchend", onEnd)
      document.removeEventListener("touchcancel", reset)
    }
  }

  private shouldManageDocumentTitle(): boolean {
    return window === window.top
  }

  private async primeDocumentTitleContext(shouldPrimeWebPageContext: boolean): Promise<void> {
    if (!this.shouldManageDocumentTitle() || !shouldPrimeWebPageContext) {
      return
    }

    try {
      await getOrCreateWebPageContext()
    }
    catch (error) {
      logger.warn("Failed to prime webpage context before translating document title:", error)
    }
  }

  private startDocumentTitleTracking(): void {
    if (!this.shouldManageDocumentTitle()) {
      return
    }

    this.lastSourceTitle = document.title || ""
    this.lastAppliedTranslatedTitle = null
    this.titleRequestVersion = 0

    this.observeDocumentTitle()
    void this.syncDocumentTitle(this.lastSourceTitle)
  }

  private stopDocumentTitleTracking(): void {
    if (!this.shouldManageDocumentTitle()) {
      return
    }

    const currentTitle = document.title || ""
    if (currentTitle !== this.lastAppliedTranslatedTitle) {
      this.lastSourceTitle = currentTitle
    }

    if (this.titleObserver) {
      this.titleObserver.disconnect()
      this.titleObserver = null
    }

    this.titleRequestVersion++

    if (this.lastSourceTitle !== null && document.title !== this.lastSourceTitle) {
      document.title = this.lastSourceTitle
    }

    this.lastSourceTitle = null
    this.lastAppliedTranslatedTitle = null
  }

  private observeDocumentTitle(): void {
    if (!document.head) {
      return
    }

    if (this.titleObserver) {
      this.titleObserver.disconnect()
    }

    this.titleObserver = new MutationObserver(() => {
      this.handleDocumentTitleMutation()
    })

    this.titleObserver.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  }

  private handleDocumentTitleMutation(): void {
    if (!this.isPageTranslating || !this.shouldManageDocumentTitle()) {
      return
    }

    const currentTitle = document.title || ""

    if (currentTitle === this.lastSourceTitle) {
      return
    }

    if (currentTitle === this.lastAppliedTranslatedTitle) {
      return
    }

    this.lastSourceTitle = currentTitle
    void this.syncDocumentTitle(currentTitle)
  }

  private async syncDocumentTitle(sourceTitle: string): Promise<void> {
    if (!sourceTitle.trim() || !this.isPageTranslating || !this.shouldManageDocumentTitle()) {
      return
    }

    const requestVersion = ++this.titleRequestVersion

    try {
      const translatedTitle = await translateTextForPageTitle(sourceTitle)
      if (!this.isPageTranslating || requestVersion !== this.titleRequestVersion) {
        return
      }

      const nextTitle = translatedTitle || sourceTitle
      this.lastAppliedTranslatedTitle = nextTitle

      if (document.title === nextTitle) {
        return
      }

      document.title = nextTitle
    }
    catch (error) {
      if (requestVersion === this.titleRequestVersion) {
        logger.warn("Failed to translate document title:", error)
      }
    }
  }

  private async observerTopLevelParagraphs(container: HTMLElement, existingConfig?: Config): Promise<void> {
    const observer = this.intersectionObserver
    if (!this.walkId || !observer)
      return

    const config = existingConfig ?? await getLocalConfig()
    if (!config) {
      logger.error("Global config is not initialized")
      return
    }

    // Skip if container has an ancestor that should not be walked into
    if (hasNoWalkAncestor(container, config))
      return

    walkAndLabelElement(container, this.walkId, config)
    // if container itself has paragraph and the id
    if (container.hasAttribute("data-read-frog-paragraph") && container.getAttribute("data-read-frog-walked") === this.walkId) {
      observer.observe(container)
      return
    }

    const paragraphs = this.collectParagraphElementsDeep(container, this.walkId)
    const topLevelParagraphs = paragraphs.filter((el) => {
      const ancestor = el.parentElement?.closest("[data-read-frog-paragraph]")
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
      result.push(...[...elements])
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
   * Track the same blocked states that the traversal skips, so hidden accordion
   * panels can be re-walked when the site reveals an existing subtree.
   */
  private isWalkBlockedElement(element: HTMLElement, config: Config): boolean {
    return isDontWalkIntoButTranslateAsChildElement(element)
      || isDontWalkIntoAndDontTranslateAsChildElement(element, config)
  }

  /**
   * Handle attribute changes and only trigger observation
   * when element transitions from blocked to walkable.
   */
  private didChangeToWalkable(element: HTMLElement, config: Config): boolean {
    const wasWalkBlocked = this.walkBlockedElementsCache.has(element)
    const isWalkBlockedNow = this.isWalkBlockedElement(element, config)

    // Update cache with current state
    if (isWalkBlockedNow) {
      this.walkBlockedElementsCache.add(element)
    }
    else {
      this.walkBlockedElementsCache.delete(element)
    }

    return wasWalkBlocked === true && isWalkBlockedNow === false
  }

  /**
   * Initialize walkability state for an element and its descendants
   */
  private addWalkBlockedElements(element: HTMLElement, config: Config): void {
    const walkBlockedElements = deepQueryTopLevelSelector(element, el => this.isWalkBlockedElement(el, config))
    walkBlockedElements.forEach(el => this.walkBlockedElementsCache.add(el))
  }

  /**
   * Start observing mutations for a container and all its shadow roots
   */
  private observeMutations(container: HTMLElement): void {
    const mutationObserver = new MutationObserver((records) => {
      void this.handleMutationRecords(records)
    })

    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden", "aria-hidden"],
    })

    this.mutationObservers.push(mutationObserver)
    this.observeIsolatedDescendantsMutations(container)
  }

  private async handleMutationRecords(records: MutationRecord[]): Promise<void> {
    const config = await getLocalConfig()
    if (!config) {
      logger.error("Global config is not initialized")
      return
    }

    for (const rec of records) {
      if (rec.type === "childList") {
        rec.addedNodes.forEach((node) => {
          if (isHTMLElement(node)) {
            this.addWalkBlockedElements(node, config)
            void this.observerTopLevelParagraphs(node, config)
            this.observeIsolatedDescendantsMutations(node)
          }
        })
      }
      else if (this.isWalkabilityAttributeMutation(rec)) {
        const el = rec.target
        if (isHTMLElement(el) && this.didChangeToWalkable(el, config)) {
          void this.observerTopLevelParagraphs(el, config)
        }
      }
    }
  }

  private isWalkabilityAttributeMutation(record: MutationRecord): boolean {
    return record.type === "attributes"
      && (record.attributeName === "style"
        || record.attributeName === "class"
        || record.attributeName === "hidden"
        || record.attributeName === "aria-hidden")
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

    // Recursively check children
    for (const child of element.children) {
      if (isHTMLElement(child)) {
        this.observeIsolatedDescendantsMutations(child)
      }
    }
  }
}
