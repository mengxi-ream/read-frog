/** Time budget for one synchronous slice of chunked DOM work (#1881). */
export const DEFAULT_WALK_BUDGET_MS = 12

interface SchedulerLike {
  yield?: () => Promise<void>
  postTask?: (callback: () => void, options?: { priority?: string }) => Promise<void>
}

/**
 * Yield to the event loop so input and rendering can run between work slices.
 * MV3 content scripts share the page's main thread, so long synchronous DOM
 * work freezes the page (#1881). Preference order: scheduler.yield (Chrome
 * 129+) → scheduler.postTask (Chrome 94+ / Firefox 101+) → MessageChannel
 * (everywhere; unlike setTimeout it dodges the nested-timer 4ms clamp) →
 * setTimeout(0).
 */
export function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: SchedulerLike }).scheduler
  if (typeof scheduler?.yield === "function") {
    return scheduler.yield()
  }
  if (typeof scheduler?.postTask === "function") {
    return scheduler.postTask(() => {}, { priority: "user-visible" })
  }
  if (typeof MessageChannel !== "undefined") {
    return new Promise((resolve) => {
      const { port1, port2 } = new MessageChannel()
      port1.onmessage = () => {
        port1.close()
        resolve()
      }
      port2.postMessage(null)
    })
  }
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export interface WorkPacer {
  deadline: number
  budgetMs: number
}

export function createWorkPacer(budgetMs: number = DEFAULT_WALK_BUDGET_MS): WorkPacer {
  return { deadline: performance.now() + budgetMs, budgetMs }
}

/** Yield to the main thread when the pacer's current slice budget is spent. */
export async function pauseIfBudgetSpent(pacer: WorkPacer): Promise<void> {
  if (performance.now() < pacer.deadline) return
  await yieldToMain()
  pacer.deadline = performance.now() + pacer.budgetMs
}
