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

  constructor(private readonly compare = (a: number, b: number) => a - b) {}

  push(item: T, priority: number) {
    this.heap.push({ key: priority, value: item })
    this.heapifyUp(this.heap.length - 1)
  }

  peek() {
    return this.heap[0]?.value
  }

  pop() {
    if (this.isEmpty())
      return undefined

    const result = this.heap[0].value
    const last = this.heap.pop()

    if (this.heap.length > 0 && last) {
      this.heap[0] = last
      this.heapifyDown(0)
    }

    return result
  }

  size() {
    return this.heap.length
  }

  isEmpty() {
    return this.heap.length === 0
  }

  clear() {
    this.heap = []
  }

  private heapifyUp(index: number) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)
      if (this.compare(this.heap[parentIndex].key, this.heap[index].key) <= 0)
        break

      [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]]
      index = parentIndex
    }
  }

  private heapifyDown(index: number) {
    let currentIndex = index
    while (true) {
      let nextIndex = currentIndex
      const leftChild = 2 * currentIndex + 1
      const rightChild = 2 * currentIndex + 2

      if (leftChild < this.heap.length
        && this.compare(this.heap[nextIndex].key, this.heap[leftChild].key) > 0) {
        nextIndex = leftChild
      }

      if (rightChild < this.heap.length
        && this.compare(this.heap[nextIndex].key, this.heap[rightChild].key) > 0) {
        nextIndex = rightChild
      }

      if (nextIndex === currentIndex)
        break

      [this.heap[currentIndex], this.heap[nextIndex]] = [this.heap[nextIndex], this.heap[currentIndex]]
      currentIndex = nextIndex
    }
  }
}
