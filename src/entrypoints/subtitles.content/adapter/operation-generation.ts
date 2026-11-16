interface OperationGeneration {
  next: () => number
  current: () => number
  isCurrent: (generation: number) => boolean
}

/** Tells async work whether it still belongs to the latest operation; next() supersedes every
 * earlier one. */
export function createOperationGeneration(): OperationGeneration {
  let latest = 0
  return {
    next: () => ++latest,
    current: () => latest,
    isCurrent: (generation) => generation === latest,
  }
}
