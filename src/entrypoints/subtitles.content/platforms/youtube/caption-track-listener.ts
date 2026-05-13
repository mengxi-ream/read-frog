import { YOUTUBE_NAVIGATE_FINISH_EVENT } from "@/utils/constants/subtitles"
import { waitForElement } from "@/utils/dom/wait-for-element"

const SETTINGS_BUTTON_SELECTOR = ".ytp-settings-button"
const SETTINGS_MENU_SELECTOR = ".ytp-settings-menu"
const MENU_ITEM_SELECTOR = ".ytp-menuitem[role='menuitem']"
const MENU_ITEM_WITH_SUBMENU_SELECTOR = `${MENU_ITEM_SELECTOR}[aria-haspopup='true']`
const MENU_ITEM_LABEL_SELECTOR = ".ytp-menuitem-label"
const MENU_ITEM_CONTENT_SELECTOR = ".ytp-menuitem-content"
const CLICK_SYNC_DELAY_MS = 50

export interface YoutubeCaptionTrackSnapshot {
  label: string
  menuHeading: string | null
  trackKey: string
}

type YoutubeTrackChangedHandler = (
  nextTrack: YoutubeCaptionTrackSnapshot,
  previousTrack: YoutubeCaptionTrackSnapshot | null,
) => void

interface YoutubeMenuSummarySnapshot extends YoutubeCaptionTrackSnapshot {
  slotKey: string
}

interface YoutubeMenuSummaryChange {
  next: YoutubeMenuSummarySnapshot
  previous: YoutubeMenuSummarySnapshot
}

class YoutubeCaptionTrackListener {
  // Guards repeated start calls and stale async rebind work.
  private started = false

  // Monotonic token used to ignore outdated waitForElement results.
  private bindAttempt = 0

  // The active YouTube settings button inside the current player.
  private observedSettingsButton: HTMLElement | null = null

  // The currently opened settings menu associated with the active button.
  private observedSettingsMenu: HTMLElement | null = null

  // Watches aria-expanded on the settings button.
  private buttonObserver: MutationObserver | null = null

  // Watches summary and selection mutations inside the settings menu.
  private menuObserver: MutationObserver | null = null

  // Delayed sync used as a fallback when menu clicks close the panel quickly.
  private clickSyncTimeoutId: ReturnType<typeof setTimeout> | null = null

  // Last observed top-level menu summaries, keyed by stable slot position.
  private lastMenuSummaryMap: Map<string, YoutubeMenuSummarySnapshot> | null = null

  // Last track-like summary snapshot exposed to callers.
  private lastTrackedSelection: YoutubeCaptionTrackSnapshot | null = null

  private readonly settingsButtonSelector: string

  constructor(
    private readonly playerContainerSelector: string,
    private readonly onTrackChanged: YoutubeTrackChangedHandler,
  ) {
    this.settingsButtonSelector = `${playerContainerSelector} ${SETTINGS_BUTTON_SELECTOR}`
  }

  start() {
    if (this.started) {
      return
    }

    this.started = true
    window.addEventListener(YOUTUBE_NAVIGATE_FINISH_EVENT, this.handleNavigateFinish)
    void this.initializeObservers()
  }

  getCurrentTrackKey() {
    return this.lastTrackedSelection?.trackKey ?? null
  }

  private async initializeObservers() {
    const attempt = ++this.bindAttempt
    const button = await waitForElement(
      this.settingsButtonSelector,
      element => !!element.closest(this.playerContainerSelector),
    )

    if (
      !this.started
      || attempt !== this.bindAttempt
      || !(button instanceof HTMLElement)
    ) {
      return
    }

    this.attachToSettingsButton(button)
  }

  private attachToSettingsButton(button: HTMLElement) {
    if (this.observedSettingsButton === button) {
      this.syncMenuObserver()
      return
    }

    this.disconnectButtonObserver()
    this.disconnectMenuObserver()
    this.observedSettingsButton = button
    this.resetTrackedSelection()

    this.buttonObserver = new MutationObserver(() => {
      this.syncMenuObserver()
    })
    this.buttonObserver.observe(button, {
      attributes: true,
      attributeFilter: ["aria-expanded"],
    })

    this.syncMenuObserver()
  }

  private syncMenuObserver() {
    const button = this.observedSettingsButton
    if (!button || !isSettingsMenuOpen(button)) {
      this.disconnectMenuObserver()
      return
    }

    const menu = this.getCurrentSettingsMenu()
    if (!menu) {
      return
    }

    if (this.observedSettingsMenu !== menu) {
      this.disconnectMenuObserver()
      this.observedSettingsMenu = menu
      menu.addEventListener("click", this.handleMenuClick)
      this.menuObserver = new MutationObserver(() => {
        this.syncCurrentSelection(true)
      })
      this.menuObserver.observe(menu, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["aria-checked", "aria-selected", "class", "hidden", "aria-hidden", "style"],
      })
    }

    this.syncCurrentSelection(false)
  }

  private syncCurrentSelection(shouldDispatch: boolean) {
    const menu = this.observedSettingsMenu ?? this.getCurrentSettingsMenu()
    if (!menu) {
      return
    }

    const currentSummaries = getCurrentSelections(menu)
    if (currentSummaries.length === 0) {
      return
    }

    const currentSummaryMap = new Map(
      currentSummaries.map(summary => [summary.slotKey, summary] as const),
    )

    if (!this.lastMenuSummaryMap) {
      this.lastMenuSummaryMap = currentSummaryMap
      if (currentSummaries.length === 1) {
        this.lastTrackedSelection = toPublicSnapshot(currentSummaries[0])
      }
      return
    }

    const changedSummaries = currentSummaries
      .map((summary) => {
        const previousSummary = this.lastMenuSummaryMap?.get(summary.slotKey) ?? null
        if (!previousSummary || previousSummary.trackKey === summary.trackKey) {
          return null
        }

        return {
          next: summary,
          previous: previousSummary,
        }
      })
      .filter((change): change is YoutubeMenuSummaryChange => change !== null)

    this.lastMenuSummaryMap = currentSummaryMap

    const latestChange = changedSummaries.at(-1)
    if (!latestChange) {
      return
    }

    this.lastTrackedSelection = toPublicSnapshot(latestChange.next)

    if (shouldDispatch) {
      this.onTrackChanged(
        toPublicSnapshot(latestChange.next),
        toPublicSnapshot(latestChange.previous),
      )
    }
  }

  private getCurrentSettingsMenu(): HTMLElement | null {
    const playerContainer = this.observedSettingsButton?.closest<HTMLElement>(
      this.playerContainerSelector,
    )
    return playerContainer?.querySelector<HTMLElement>(SETTINGS_MENU_SELECTOR) ?? null
  }

  private scheduleDeferredSync() {
    if (this.clickSyncTimeoutId !== null) {
      clearTimeout(this.clickSyncTimeoutId)
    }

    this.clickSyncTimeoutId = setTimeout(() => {
      this.clickSyncTimeoutId = null
      this.syncCurrentSelection(true)
    }, CLICK_SYNC_DELAY_MS)
  }

  private clearDeferredSync() {
    if (this.clickSyncTimeoutId !== null) {
      clearTimeout(this.clickSyncTimeoutId)
      this.clickSyncTimeoutId = null
    }
  }

  private disconnectButtonObserver() {
    this.buttonObserver?.disconnect()
    this.buttonObserver = null
    this.observedSettingsButton = null
    this.clearDeferredSync()
  }

  private disconnectMenuObserver() {
    this.menuObserver?.disconnect()
    this.menuObserver = null
    this.observedSettingsMenu?.removeEventListener("click", this.handleMenuClick)
    this.observedSettingsMenu = null
  }

  private resetTrackedSelection() {
    this.lastMenuSummaryMap = null
    this.lastTrackedSelection = null
  }

  private handleMenuClick = (event: Event) => {
    const menu = this.observedSettingsMenu
    if (!menu) {
      return
    }

    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }

    const clickedItem = target.closest<HTMLElement>(MENU_ITEM_SELECTOR)
    const clickedRadio = target.closest<HTMLElement>("[role='menuitemradio']")
    if (
      (!clickedItem || !menu.contains(clickedItem))
      && (!clickedRadio || !menu.contains(clickedRadio))
    ) {
      return
    }

    this.scheduleDeferredSync()
  }

  private handleNavigateFinish = () => {
    this.disconnectButtonObserver()
    this.disconnectMenuObserver()
    this.resetTrackedSelection()
    void this.initializeObservers()
  }
}

export function createYoutubeCaptionTrackListener({
  playerContainerSelector,
  onTrackChanged,
}: {
  playerContainerSelector: string
  onTrackChanged: YoutubeTrackChangedHandler
}) {
  return new YoutubeCaptionTrackListener(playerContainerSelector, onTrackChanged)
}

function isSettingsMenuOpen(button: HTMLElement): boolean {
  return button.getAttribute("aria-expanded") === "true"
}

function getCurrentSelections(settingsMenu: HTMLElement): YoutubeMenuSummarySnapshot[] {
  return Array.from(
    settingsMenu.querySelectorAll<HTMLElement>(MENU_ITEM_WITH_SUBMENU_SELECTOR),
  )
    .map((item, index) => getSummarySelection(item, index))
    .filter((summary): summary is YoutubeMenuSummarySnapshot => summary !== null)
}

function getSummarySelection(
  item: HTMLElement,
  index: number,
): YoutubeMenuSummarySnapshot | null {
  const summary = normalizeMenuText(
    item.querySelector<HTMLElement>(MENU_ITEM_CONTENT_SELECTOR)?.textContent ?? "",
  )
  if (!summary) {
    return null
  }

  const menuHeading = getMenuItemLabel(item) || null
  const slotKey = `top-level-summary::${index}`

  return {
    label: summary,
    menuHeading,
    slotKey,
    trackKey: `${slotKey}::${summary}`,
  }
}

function getMenuItemLabel(item: HTMLElement): string {
  const labelContainer = item.querySelector<HTMLElement>(MENU_ITEM_LABEL_SELECTOR)
  if (!labelContainer) {
    return ""
  }

  const labelParts = Array.from(labelContainer.querySelectorAll<HTMLElement>("span"))
    .filter(part => !part.classList.contains("ytp-menuitem-label-count"))
    .map(part => normalizeMenuText(part.textContent ?? ""))
    .filter(Boolean)

  if (labelParts.length > 0) {
    return labelParts.join(" ")
  }

  return normalizeMenuText(labelContainer.textContent ?? "")
}

function toPublicSnapshot(summary: YoutubeMenuSummarySnapshot): YoutubeCaptionTrackSnapshot {
  return {
    label: summary.label,
    menuHeading: summary.menuHeading,
    trackKey: summary.trackKey,
  }
}

function normalizeMenuText(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}
