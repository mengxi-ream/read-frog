import type { FeatureUsageContext } from "@/types/analytics"
import type { Config } from "@/types/config/config"
import debounce from "debounce"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { isLLMProviderConfig } from "@/types/config/provider"
import { createFeatureUsageContext, trackFeatureUsed } from "@/utils/analytics"
import { getLocalConfig } from "@/utils/config/storage"
import {
  CONTENT_WRAPPER_CLASS,
  REACT_SHADOW_HOST_CLASS,
  SPINNER_CLASS,
} from "@/utils/constants/dom-labels"
import { resolveProviderConfig } from "@/utils/constants/feature-providers"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import {
  hasNoWalkAncestor,
  isDontWalkIntoAndDontTranslateAsChildElement,
  isDontWalkIntoButTranslateAsChildElement,
  isHTMLElement,
} from "@/utils/host/dom/filter"
import { deepQueryTopLevelSelector } from "@/utils/host/dom/find"
import { walkAndLabelElement } from "@/utils/host/dom/traversal"
import {
  findStaleBilingualLayoutSource,
  findStaleTranslationOnlyAnchor,
  wasCharacterDataChangeExtensionDriven,
  wasNodeRemovedByExtension,
} from "@/utils/host/translate/core/translation-state"
import {
  removeAllTranslatedWrapperNodes,
  translateNodes,
  translateNodesBilingualMode,
  translateWalkedElement,
} from "@/utils/host/translate/node-manipulation"
import { validateTranslationConfigAndToast } from "@/utils/host/translate/translate-text"
import { translateTextForPageTitle } from "@/utils/host/translate/translate-variants"
import { ensureSiteRuleCSS, removeSiteRuleCSS } from "@/utils/host/translate/ui/style-injector"
import { getOrCreateWebPageContext } from "@/utils/host/translate/webpage-context"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"
import { removeReactShadowHost } from "@/utils/react-shadow-host/create-shadow-host"
import { getEffectiveSiteRule } from "@/utils/site-rules/effective"

type SimpleIntersectionOptions = Omit<IntersectionObserverInit, "threshold"> & {
  threshold?: number
}

type DebouncedRetry = (() => void) & { clear: () => void }

interface RetranslationBudget {
  windowStart: number
  passes: number
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
   * Refreshes translation after an in-document route change without disabling
   * the tab-level page translation session.
   */
  restart: () => Promise<void>

  /**
   * Registers page translation triggers
   */
  registerPageTranslationTriggers: () => () => void
}

export class PageTranslationManager implements IPageTranslationManager {
  private static readonly MAX_DURATION = 500
  private static readonly MOVE_THRESHOLD = 30 * 30
  /** Max synchronous passes of the retranslation loop per invocation. */
  private static readonly MAX_REFRESH_PASSES = 3
  /** Rolling budget: at most MAX_PASSES_PER_WINDOW passes per source per window. */
  private static readonly RETRANSLATE_WINDOW_MS = 10_000
  private static readonly MAX_PASSES_PER_WINDOW = 6
  private static readonly RETRANSLATE_RETRY_DEBOUNCE_MS = 1_000
  private static readonly DEFAULT_INTERSECTION_OPTIONS: SimpleIntersectionOptions = {
    root: null,
    rootMargin: "600px",
    threshold: 0.1,
  }

  private isPageTranslating: boolean = false
  private intersectionObserver: IntersectionObserver | null = null
  private mutationObservers: MutationObserver[] = []
  private observedMutationRoots = new WeakSet<Node>()
  private walkId: string | null = null
  private intersectionOptions: IntersectionObserverInit
  private walkBlockedElementsCache = new WeakSet<HTMLElement>()
  private refreshingTranslatedSources = new WeakSet<HTMLElement>()
  private translatedSourceMutationVersions = new WeakMap<HTMLElement, number>()
  private retranslationBudgets = new WeakMap<HTMLElement, RetranslationBudget>()
  private retranslateRetries = new WeakMap<HTMLElement, DebouncedRetry>()
  // Strong and enumerable so stop() can cancel in-flight retries; entries are
  // removed when a retry fires, so the set only holds armed timers.
  private pendingRetranslateRetries = new Set<DebouncedRetry>()
  private translationSessionVersion = 0
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

    if (
      !validateTranslationConfigAndToast({
        providersConfig: config.providersConfig,
        translate: config.translate,
        language: config.language,
      })
    ) {
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
        url: window.location.href,
      })

      this.isPageTranslating = true
      this.translationSessionVersion += 1

      const siteRule = getEffectiveSiteRule(config, window.location.href)
      if (siteRule.injectedCss) {
        void ensureSiteRuleCSS(document, siteRule.injectedCss)
      }

      await this.primeDocumentTitleContext(
        config.translate.enableAIContentAware && isLLMProviderConfig(providerConfig),
      )
      this.startDocumentTitleTracking()

      // Listen to existing elements when they enter the viewport
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
      await this.observeTopLevelParagraphs(document.body, config)

      // Start observing mutations from document.body and all shadow roots
      this.observeMutations(document.body)

      if (trackedContext) {
        void trackFeatureUsed({
          ...trackedContext,
          outcome: "success",
        })
      }
    } catch (error) {
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
    this.stopInternal({ notify: true })
  }

  async restart(): Promise<void> {
    if (!this.isPageTranslating) {
      await this.start()
      return
    }

    this.stopInternal({ notify: false })
    await this.start()
  }

  private stopInternal({ notify }: { notify: boolean }): void {
    if (!this.isPageTranslating) {
      console.warn("PageTranslationManager is already inactive")
      return
    }

    if (notify) {
      void sendMessage("setAndNotifyPageTranslationStateChangedByManager", {
        enabled: false,
        url: window.location.href,
      })
    }

    this.isPageTranslating = false
    this.translationSessionVersion += 1
    this.walkId = null
    this.walkBlockedElementsCache = new WeakSet()
    this.refreshingTranslatedSources = new WeakSet()
    this.translatedSourceMutationVersions = new WeakMap()
    this.pendingRetranslateRetries.forEach((retry) => retry.clear())
    this.pendingRetranslateRetries.clear()
    this.retranslateRetries = new WeakMap()
    this.retranslationBudgets = new WeakMap()
    this.stopDocumentTitleTracking()

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect()
      this.intersectionObserver = null
    }
    this.mutationObservers.forEach((observer) => observer.disconnect())
    this.mutationObservers = []
    this.observedMutationRoots = new WeakSet()

    removeSiteRuleCSS(document)
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
      } else {
        reset()
      }
    }

    const onMove = (e: TouchEvent) => {
      if (!startTouches) return
      if (e.touches.length !== 4) return reset()

      for (let i = 0; i < 4; i++) {
        const dx = e.touches[i].clientX - startTouches[i].clientX
        const dy = e.touches[i].clientY - startTouches[i].clientY
        if (dx * dx + dy * dy > PageTranslationManager.MOVE_THRESHOLD) return reset()
      }
    }

    const onEnd = () => {
      if (!startTouches) return
      if (performance.now() - startTime < PageTranslationManager.MAX_DURATION) {
        if (this.isPageTranslating) {
          this.stop()
        } else {
          void this.start(
            createFeatureUsageContext(
              ANALYTICS_FEATURE.PAGE_TRANSLATION,
              ANALYTICS_SURFACE.TOUCH_GESTURE,
            ),
          )
        }
      }
      reset()
    }

    document.addEventListener("touchstart", onStart, { passive: true })
    document.addEventListener("touchmove", onMove, { passive: true })
    document.addEventListener("touchend", onEnd, { passive: true })
    document.addEventListener("touchcancel", reset, { passive: true })

    // Teardown: remove all touch listeners
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
    } catch (error) {
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
    } catch (error) {
      if (requestVersion === this.titleRequestVersion) {
        logger.warn("Failed to translate document title:", error)
      }
    }
  }

  private async observeTopLevelParagraphs(
    container: HTMLElement,
    existingConfig?: Config,
  ): Promise<void> {
    const observer = this.intersectionObserver
    if (!this.walkId || !observer) return

    const config = existingConfig ?? (await getLocalConfig())
    if (!config) {
      logger.error("Global config is not initialized")
      return
    }

    // Skip if container has an ancestor that should not be walked into
    if (hasNoWalkAncestor(container, config)) return

    walkAndLabelElement(container, this.walkId, config)
    // if container itself has paragraph and the id
    if (
      container.hasAttribute("data-read-frog-paragraph") &&
      container.getAttribute("data-read-frog-walked") === this.walkId
    ) {
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
    topLevelParagraphs.forEach((el) => observer.observe(el))
  }

  /**
   * Recursively collect elements with paragraph attributes from shadow roots and iframes
   */
  private collectParagraphElementsDeep(container: HTMLElement, walkId: string): HTMLElement[] {
    const result: HTMLElement[] = []

    const collectFromContainer = (root: HTMLElement | Document | ShadowRoot) => {
      const elements = root.querySelectorAll<HTMLElement>(
        `[data-read-frog-paragraph][data-read-frog-walked="${CSS.escape(walkId)}"]`,
      )
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
    return (
      isDontWalkIntoButTranslateAsChildElement(element, config) ||
      isDontWalkIntoAndDontTranslateAsChildElement(element, config)
    )
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
    } else {
      this.walkBlockedElementsCache.delete(element)
    }

    return wasWalkBlocked && !isWalkBlockedNow
  }

  /**
   * Initialize walkability state for an element and its descendants
   */
  private addWalkBlockedElements(element: HTMLElement, config: Config): void {
    const walkBlockedElements = deepQueryTopLevelSelector(element, (el) =>
      this.isWalkBlockedElement(el, config),
    )
    walkBlockedElements.forEach((el) => this.walkBlockedElementsCache.add(el))
  }

  /**
   * Start observing mutations for a container and all its shadow roots
   */
  private observeMutations(container: HTMLElement): void {
    // Dynamic pages re-add the same subtrees repeatedly; without dedup every
    // re-added shadow host gained a duplicate subtree observer (#1831).
    if (!this.observedMutationRoots.has(container)) {
      this.observedMutationRoots.add(container)
      const mutationObserver = new MutationObserver((records) => {
        void this.handleMutationRecords(records)
      })

      mutationObserver.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["style", "class", "hidden", "aria-hidden"],
      })

      this.mutationObservers.push(mutationObserver)
    }
    this.observeIsolatedDescendantsMutations(container)
  }

  private static readonly SELF_NODE_CLASSES = [
    CONTENT_WRAPPER_CLASS,
    REACT_SHADOW_HOST_CLASS,
    SPINNER_CLASS,
  ]

  private isExtensionUtilityNode(node: Node): boolean {
    return (
      isHTMLElement(node) &&
      PageTranslationManager.SELF_NODE_CLASSES.some((cls) => node.classList.contains(cls))
    )
  }

  /**
   * Mutations the extension itself causes (wrapper/spinner/error-UI churn) must
   * not re-enter the staleness/traversal pipeline, or every translation becomes
   * fuel for the next retranslation (#1831). Site-driven removals of our
   * wrappers stay classified as host mutations so they retranslate once.
   */
  private isSelfInflictedRecord(record: MutationRecord): boolean {
    // Wrapper classes/styles are set before insertion and data-read-frog-*
    // labels are not observed, so attribute records are never self-caused.
    if (record.type === "attributes") return false
    // In-place swaps/restores write the site's own text nodes (no wrapper
    // ancestor); classify by the exact value the extension last wrote.
    if (record.type === "characterData" && wasCharacterDataChangeExtensionDriven(record.target)) {
      return true
    }
    const targetElement = isHTMLElement(record.target) ? record.target : record.target.parentElement
    if (targetElement?.closest(`.${CONTENT_WRAPPER_CLASS}`)) return true
    if (record.type !== "childList") return false
    const added = [...record.addedNodes]
    const removed = [...record.removedNodes]
    if (added.length === 0 && removed.length === 0) return false
    return (
      added.every((node) => this.isExtensionUtilityNode(node)) &&
      removed.every((node) => this.isExtensionUtilityNode(node) && wasNodeRemovedByExtension(node))
    )
  }

  /**
   * When the SITE removes a subtree containing our error UI or spinners, none
   * of the extension's cleanup paths run: the React root never unmounts and
   * its window.matchMedia listener + store subscription pin the detached
   * subtree forever; infinite spinner animations likewise root their targets.
   */
  private cleanupDetachedTranslationArtifacts(removedNodes: NodeList): void {
    for (const node of removedNodes) {
      if (!isHTMLElement(node) || node.isConnected) continue
      if (wasNodeRemovedByExtension(node)) continue
      if (node.classList.contains(REACT_SHADOW_HOST_CLASS)) {
        removeReactShadowHost(node)
        continue
      }
      if (!node.firstElementChild) continue
      node
        .querySelectorAll<HTMLElement>(`.${REACT_SHADOW_HOST_CLASS}`)
        .forEach((host) => removeReactShadowHost(host))
      node
        .querySelectorAll<HTMLElement>(`.${SPINNER_CLASS}`)
        .forEach((spinner) => spinner.getAnimations?.().forEach((animation) => animation.cancel()))
    }
  }

  private async handleMutationRecords(records: MutationRecord[]): Promise<void> {
    const sessionVersion = this.translationSessionVersion
    const hostRecords: MutationRecord[] = []
    for (const record of records) {
      if (record.type === "childList") {
        this.cleanupDetachedTranslationArtifacts(record.removedNodes)
      }
      if (!this.isSelfInflictedRecord(record)) hostRecords.push(record)
    }
    if (hostRecords.length === 0) return

    const staleTranslatedSources = new Set<HTMLElement>()
    for (const record of hostRecords) {
      const staleSource = findStaleBilingualLayoutSource(record.target)
      if (staleSource) staleTranslatedSources.add(staleSource)
      // In-place-swapped anchors (translationOnly): host re-renders such as an
      // expand/"show more" must retranslate, not stay in the source language.
      const staleAnchor = findStaleTranslationOnlyAnchor(record.target)
      if (staleAnchor) staleTranslatedSources.add(staleAnchor)
    }
    staleTranslatedSources.forEach((source) => {
      const nextVersion = (this.translatedSourceMutationVersions.get(source) ?? 0) + 1
      this.translatedSourceMutationVersions.set(source, nextVersion)
    })

    const needsTraversalHandling = hostRecords.some((record) => record.type !== "characterData")
    if (staleTranslatedSources.size === 0 && !needsTraversalHandling) return

    const config = await getLocalConfig()
    if (!config) {
      logger.error("Global config is not initialized")
      return
    }
    if (!this.isPageTranslating || this.translationSessionVersion !== sessionVersion) return

    for (const rec of hostRecords) {
      if (rec.type === "childList") {
        rec.addedNodes.forEach((node) => {
          if (isHTMLElement(node)) {
            this.addWalkBlockedElements(node, config)
            void this.observeTopLevelParagraphs(node, config)
            this.observeIsolatedDescendantsMutations(node)
          }
        })
      } else if (this.isWalkabilityAttributeMutation(rec)) {
        const el = rec.target
        if (isHTMLElement(el) && this.didChangeToWalkable(el, config)) {
          void this.observeTopLevelParagraphs(el, config)
        }
      }
    }

    await Promise.all(
      [...staleTranslatedSources].map((source) =>
        this.retranslateChangedSource(source, config, sessionVersion),
      ),
    )
  }

  private async retranslateChangedSource(
    source: HTMLElement,
    config: Config,
    sessionVersion: number,
  ): Promise<void> {
    const walkId = this.walkId
    const refreshingSources = this.refreshingTranslatedSources
    const mutationVersions = this.translatedSourceMutationVersions
    if (
      !this.isPageTranslating ||
      this.translationSessionVersion !== sessionVersion ||
      !walkId ||
      !source.isConnected ||
      refreshingSources.has(source)
    ) {
      return
    }

    refreshingSources.add(source)
    let handledVersion = 0
    let passes = 0
    try {
      do {
        if (!this.consumeRetranslationBudget(source)) {
          // Budget exhausted: converge later instead of looping now (#1831).
          this.scheduleRetranslateRetry(source, sessionVersion)
          return
        }
        passes += 1
        handledVersion = mutationVersions.get(source) ?? 0
        if (config.translate.mode === "translationOnly") {
          // Swapped-anchor staleness: translateNodes routes to the
          // translationOnly path, which restores surviving swaps first so the
          // provider sees current host text, then re-swaps. Keyed on the MODE,
          // not on anchor-state presence — a scheduled retry must never insert
          // bilingual wrappers into a translationOnly session.
          await translateNodes([source], walkId, false, config)
        } else {
          walkAndLabelElement(source, walkId, config)
          await translateNodesBilingualMode([source], walkId, config)
        }
      } while (
        this.isPageTranslating &&
        this.translationSessionVersion === sessionVersion &&
        this.walkId === walkId &&
        source.isConnected &&
        (mutationVersions.get(source) ?? 0) !== handledVersion &&
        passes < PageTranslationManager.MAX_REFRESH_PASSES
      )
      if (
        this.isPageTranslating &&
        this.translationSessionVersion === sessionVersion &&
        this.walkId === walkId &&
        source.isConnected &&
        (mutationVersions.get(source) ?? 0) !== handledVersion
      ) {
        // Still dirty after the pass cap — defer the follow-up.
        this.scheduleRetranslateRetry(source, sessionVersion)
      }
    } finally {
      refreshingSources.delete(source)
      if (mutationVersions.get(source) === handledVersion) {
        mutationVersions.delete(source)
      }
    }
  }

  private consumeRetranslationBudget(source: HTMLElement): boolean {
    const now = Date.now()
    const budget = this.retranslationBudgets.get(source)
    if (!budget || now - budget.windowStart > PageTranslationManager.RETRANSLATE_WINDOW_MS) {
      this.retranslationBudgets.set(source, { windowStart: now, passes: 1 })
      return true
    }
    if (budget.passes >= PageTranslationManager.MAX_PASSES_PER_WINDOW) return false
    budget.passes += 1
    return true
  }

  private scheduleRetranslateRetry(source: HTMLElement, sessionVersion: number): void {
    let retry = this.retranslateRetries.get(source)
    if (!retry) {
      const debounced = debounce(() => {
        this.pendingRetranslateRetries.delete(debounced)
        void this.runScheduledRetranslate(source, sessionVersion)
      }, PageTranslationManager.RETRANSLATE_RETRY_DEBOUNCE_MS) as unknown as DebouncedRetry
      retry = debounced
      this.retranslateRetries.set(source, retry)
    }
    this.pendingRetranslateRetries.add(retry)
    retry()
  }

  private async runScheduledRetranslate(
    source: HTMLElement,
    sessionVersion: number,
  ): Promise<void> {
    if (!this.isPageTranslating || this.translationSessionVersion !== sessionVersion) return
    // No pending mutation version means the source converged in the meantime.
    if (this.translatedSourceMutationVersions.get(source) === undefined) return
    const config = await getLocalConfig()
    if (!config) return
    if (!this.isPageTranslating || this.translationSessionVersion !== sessionVersion) return
    await this.retranslateChangedSource(source, config, sessionVersion)
  }

  private isWalkabilityAttributeMutation(record: MutationRecord): boolean {
    return (
      record.type === "attributes" &&
      (record.attributeName === "style" ||
        record.attributeName === "class" ||
        record.attributeName === "hidden" ||
        record.attributeName === "aria-hidden")
    )
  }

  /**
   * Recursively find and observe shadow roots and iframes in an element and its descendants
   * These can't be found as top level paragraph elements because isolated shadow roots and iframes are not
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
