interface PriorityQueue<T> {
  push: (item: T, priority: number) => void
  peek: () => T | undefined
  pop: () => T | undefined
  size: () => number
  isEmpty: () => boolean
  clear: () => void
}

export class BinaryHeapPQ<T> implements PriorityQueue<T> {
  private heap: { key: number, value: T }[] = []
}
