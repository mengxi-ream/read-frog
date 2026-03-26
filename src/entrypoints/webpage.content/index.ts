import { defineContentScript } from "#imports"
import { logger } from "@/utils/logger"
import { onMessage } from "@/utils/message"

type TranslationSessionState = "idle" | "translating" | "active" | "recovering"

class TranslationSession {
  private state: TranslationSessionState = "idle"
  private enabled = false
  private mutationTimer: ReturnType<typeof setTimeout> | null = null
  private readonly urlKey = `${location.origin}${location.pathname}${location.search}`

  constructor(
    private readonly startTranslation: () => Promise<void>,
    private readonly stopTranslation: () => Promise<void>,
    private readonly reconcileTranslation: () => Promise<void>,
  ) {}

  async start() {
    if (this.enabled)
      return

    this.enabled = true
    this.state = "translating"
    await this.startTranslation()
    this.state = "active"
  }

  async stop() {
    if (!this.enabled)
      return

    this.enabled = false
    this.state = "idle"

    if (this.mutationTimer) {
      clearTimeout(this.mutationTimer)
      this.mutationTimer = null
    }

    await this.stopTranslation()
  }

  onMutations() {
    if (!this.enabled)
      return

    if (this.state === "idle")
      return

    this.state = "recovering"

    if (this.mutationTimer)
      clearTimeout(this.mutationTimer)

    this.mutationTimer = setTimeout(async () => {
      this.mutationTimer = null
      if (!this.enabled)
        return

      try {
        await this.reconcileTranslation()
        this.state = "active"
      }
      catch (error) {
        logger.error("Failed to reconcile page translation", error)
        this.state = "active"
      }
    }, 250)
  }

  shouldResetForNavigation() {
    const currentKey = `${location.origin}${location.pathname}${location.search}`
    return currentKey !== this.urlKey
  }
}

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  async main() {
    const startTranslation = async () => {
      await onMessage("startPageTranslation")
    }

    const stopTranslation = async () => {
      await onMessage("stopPageTranslation")
    }

    const reconcileTranslation = async () => {
      await onMessage("reconcilePageTranslation")
    }

    const session = new TranslationSession(startTranslation, stopTranslation, reconcileTranslation)

    const observer = new MutationObserver(() => {
      if (session.shouldResetForNavigation())
        return
      session.onMutations()
    })

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    window.addEventListener("beforeunload", () => {
      observer.disconnect()
      void session.stop()
    })

    onMessage("togglePageTranslation", async (msg) => {
      if (msg.data?.enabled)
        await session.start()
      else
        await session.stop()
    })
  },
})
