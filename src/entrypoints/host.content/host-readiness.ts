import type { ContentScriptContext } from "#imports"

declare global {
  interface Window {
    __READ_FROG_HOST_READY__?: Promise<boolean>
  }
}

export async function waitForHostContentReady(
  ctx: ContentScriptContext,
  ready: Promise<boolean>,
): Promise<void> {
  window.__READ_FROG_HOST_READY__ = ready
  ctx.onInvalidated(() => {
    if (window.__READ_FROG_HOST_READY__ === ready) {
      delete window.__READ_FROG_HOST_READY__
    }
  })

  try {
    await ready
  } catch (error) {
    if (window.__READ_FROG_HOST_READY__ === ready) {
      window.__READ_FROG_HOST_INJECTED__ = false
    }
    throw error
  }
}
