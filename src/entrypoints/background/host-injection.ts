import type { Browser } from "#imports"
import { browser } from "#imports"

const pendingHostInitialization = new Map<number, Promise<boolean>>()

export async function ensureHostContentInitialized(tabId: number): Promise<boolean> {
  const pending = pendingHostInitialization.get(tabId)
  if (pending) return pending

  const initialization = initializeHostContent(tabId)
  pendingHostInitialization.set(tabId, initialization)

  return initialization.finally(() => pendingHostInitialization.delete(tabId))
}

async function initializeHostContent(tabId: number): Promise<boolean> {
  const isHostReady = await waitForHostContentReady(tabId)
  if (isHostReady !== null) return isHostReady

  await browser.scripting.executeScript({
    target: { tabId },
    files: ["/content-scripts/host.js"],
  })

  const initialized = await waitForHostContentReady(tabId)
  if (initialized === null) throw new Error("Host content script did not initialize")
  return initialized
}

// true: exists
// null: not exists
// false: exists but disabled
async function waitForHostContentReady(tabId: number): Promise<boolean | null> {
  const [injection] = (await browser.scripting.executeScript({
    target: { tabId },
    func: async () => {
      const task = window.__READ_FROG_HOST_READY__
      if (!task) return null

      return await task
    },
  }))

  if (injection?.result !== undefined) return injection.result

  // Firefox returns script failures in the result instead of rejecting executeScript.
  // @ts-expect-error
  if (injection?.error !== undefined) throw injection.error

  throw new Error("Failed to read host content initialization state")
}
