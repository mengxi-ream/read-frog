import { browser } from '#imports'

export function setupIframeInjection() {
  // Listen for iframe loads and inject content scripts programmatically
  // This catches iframes that Chrome's manifest-based all_frames: true misses
  // (e.g., dynamically created iframes, sandboxed iframes like edX)
  browser.webNavigation.onCompleted.addListener(async (details) => {
    // Skip main frame (frameId === 0), only handle iframes
    if (details.frameId === 0)
      return

    try {
      // Inject host.content script into the iframe
      await browser.scripting.executeScript({
        target: { tabId: details.tabId, frameIds: [details.frameId] },
        files: ['content-scripts/host.js'],
      })

      // Inject selection.content script into the iframe
      await browser.scripting.executeScript({
        target: { tabId: details.tabId, frameIds: [details.frameId] },
        files: ['content-scripts/selection.js'],
      })
    }
    catch {
      // Ignore errors for frames we can't access (e.g., chrome:// URLs, about:blank)
      // This is expected and not an error condition
    }
  })
}
