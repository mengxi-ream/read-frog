/**
 * Utility for batching DOM operations to minimize layout thrashing and style recalculations
 */

type DOMOperation = () => void

class DOMBatcher {
  private operations: DOMOperation[] = []
  private rafId: number | null = null
  private isProcessing = false

  /**
   * Add a DOM operation to the batch queue
   */
  queue(operation: DOMOperation): void {
    this.operations.push(operation)
    this.scheduleFlush()
  }

  /**
   * Schedule a flush using requestAnimationFrame
   */
  private scheduleFlush(): void {
    if (this.rafId !== null || this.isProcessing)
      return

    this.rafId = requestAnimationFrame(() => {
      this.flush()
    })
  }

  /**
   * Execute all queued operations in a single batch
   */
  private flush(): void {
    this.rafId = null
    if (this.operations.length === 0)
      return

    this.isProcessing = true
    const ops = this.operations.splice(0)

    // Execute all operations in a single frame
    for (const op of ops) {
      try {
        op()
      }
      catch (error) {
        console.error('Error executing batched DOM operation:', error)
      }
    }

    this.isProcessing = false

    // If new operations were queued during execution, schedule them
    if (this.operations.length > 0) {
      this.scheduleFlush()
    }
  }

  /**
   * Force flush all pending operations immediately
   */
  flushImmediate(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.flush()
  }
}

// Singleton instance for the entire application
const domBatcher = new DOMBatcher()

/**
 * Queue a DOM operation to be executed in a batched manner
 * This helps reduce layout thrashing by grouping DOM writes together
 *
 * @example
 * // Instead of:
 * element.appendChild(child1)
 * element.appendChild(child2)
 * element.appendChild(child3)
 *
 * // Use:
 * batchDOMOperation(() => element.appendChild(child1))
 * batchDOMOperation(() => element.appendChild(child2))
 * batchDOMOperation(() => element.appendChild(child3))
 */
export function batchDOMOperation(operation: DOMOperation): void {
  domBatcher.queue(operation)
}

/**
 * Force flush all pending batched operations immediately
 * Useful for testing or when you need operations to complete synchronously
 */
export function flushBatchedOperations(): void {
  domBatcher.flushImmediate()
}

/**
 * Create a DocumentFragment for batch appending multiple nodes
 * This is useful when you need to insert multiple nodes at once
 *
 * @example
 * const fragment = createFragment()
 * fragment.appendChild(child1)
 * fragment.appendChild(child2)
 * batchDOMOperation(() => parent.appendChild(fragment))
 */
export function createFragment(ownerDocument: Document = document): DocumentFragment {
  return ownerDocument.createDocumentFragment()
}
