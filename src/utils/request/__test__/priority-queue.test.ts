import { beforeEach, describe, expect, it } from 'vitest'
import { BinaryHeapPQ } from '../priority-queue'

describe('binaryHeapPQ', () => {
  let pq: BinaryHeapPQ<string>

  beforeEach(() => {
    pq = new BinaryHeapPQ<string>()
  })

  describe('constructor', () => {
    it('should create an empty priority queue with default comparison', () => {
      expect(pq.isEmpty()).toBe(true)
      expect(pq.size()).toBe(0)
      expect(pq.peek()).toBeUndefined()
    })

    it('should create priority queue with custom comparison function', () => {
      // Max heap (reverse order)
      const maxHeapPQ = new BinaryHeapPQ<number>((a, b) => b - a)

      maxHeapPQ.push(1, 1)
      maxHeapPQ.push(2, 2)
      maxHeapPQ.push(3, 3)

      // Should return highest priority first (3)
      expect(maxHeapPQ.pop()).toBe(3)
      expect(maxHeapPQ.pop()).toBe(2)
      expect(maxHeapPQ.pop()).toBe(1)
    })
  })

  describe('push', () => {
    it('should add single item', () => {
      pq.push('first', 1)

      expect(pq.size()).toBe(1)
      expect(pq.isEmpty()).toBe(false)
      expect(pq.peek()).toBe('first')
    })

    it('should maintain priority order when adding multiple items', () => {
      pq.push('low', 10)
      pq.push('high', 1)
      pq.push('medium', 5)

      expect(pq.size()).toBe(3)
      expect(pq.peek()).toBe('high') // priority 1 (lowest number = highest priority)
    })

    it('should handle same priorities', () => {
      pq.push('first', 5)
      pq.push('second', 5)
      pq.push('third', 5)

      expect(pq.size()).toBe(3)
      // Should return one of the items with priority 5
      const result = pq.peek()
      expect(['first', 'second', 'third']).toContain(result)
    })

    it('should handle negative priorities', () => {
      pq.push('negative', -5)
      pq.push('positive', 5)
      pq.push('zero', 0)

      expect(pq.peek()).toBe('negative') // -5 is lowest, so highest priority
    })
  })

  describe('peek', () => {
    it('should return undefined for empty queue', () => {
      expect(pq.peek()).toBeUndefined()
    })

    it('should return highest priority item without removing it', () => {
      pq.push('low', 10)
      pq.push('high', 1)

      expect(pq.peek()).toBe('high')
      expect(pq.size()).toBe(2) // Should not remove the item
      expect(pq.peek()).toBe('high') // Should still be there
    })
  })

  describe('pop', () => {
    it('should return undefined for empty queue', () => {
      expect(pq.pop()).toBeUndefined()
    })

    it('should remove and return highest priority item', () => {
      pq.push('low', 10)
      pq.push('high', 1)
      pq.push('medium', 5)

      expect(pq.pop()).toBe('high')
      expect(pq.size()).toBe(2)
      expect(pq.peek()).toBe('medium')
    })

    it('should return items in priority order', () => {
      const items = [
        { value: 'first', priority: 1 },
        { value: 'second', priority: 2 },
        { value: 'third', priority: 3 },
        { value: 'fourth', priority: 4 },
        { value: 'fifth', priority: 5 },
      ]

      // Add in random order
      items.reverse().forEach(item => pq.push(item.value, item.priority))

      // Should come out in priority order (lowest priority number first)
      const sortedItems = [...items].sort((a, b) => a.priority - b.priority)
      sortedItems.forEach((item) => {
        expect(pq.pop()).toBe(item.value)
      })

      expect(pq.isEmpty()).toBe(true)
    })

    it('should handle single item queue', () => {
      pq.push('only', 1)

      expect(pq.pop()).toBe('only')
      expect(pq.isEmpty()).toBe(true)
      expect(pq.peek()).toBeUndefined()
    })

    it('should handle queue becoming empty', () => {
      pq.push('item1', 1)
      pq.push('item2', 2)

      pq.pop()
      pq.pop()

      expect(pq.isEmpty()).toBe(true)
      expect(pq.pop()).toBeUndefined()
    })
  })

  describe('size', () => {
    it('should return 0 for empty queue', () => {
      expect(pq.size()).toBe(0)
    })

    it('should return correct size as items are added and removed', () => {
      expect(pq.size()).toBe(0)

      pq.push('item1', 1)
      expect(pq.size()).toBe(1)

      pq.push('item2', 2)
      expect(pq.size()).toBe(2)

      pq.pop()
      expect(pq.size()).toBe(1)

      pq.pop()
      expect(pq.size()).toBe(0)
    })
  })

  describe('isEmpty', () => {
    it('should return true for new queue', () => {
      expect(pq.isEmpty()).toBe(true)
    })

    it('should return false when items are present', () => {
      pq.push('item', 1)
      expect(pq.isEmpty()).toBe(false)
    })

    it('should return true after all items are removed', () => {
      pq.push('item1', 1)
      pq.push('item2', 2)

      pq.pop()
      pq.pop()

      expect(pq.isEmpty()).toBe(true)
    })

    it('should return true after clear', () => {
      pq.push('item1', 1)
      pq.push('item2', 2)

      pq.clear()

      expect(pq.isEmpty()).toBe(true)
    })
  })

  describe('clear', () => {
    it('should clear empty queue', () => {
      pq.clear()

      expect(pq.isEmpty()).toBe(true)
      expect(pq.size()).toBe(0)
    })

    it('should clear non-empty queue', () => {
      pq.push('item1', 1)
      pq.push('item2', 2)
      pq.push('item3', 3)

      pq.clear()

      expect(pq.isEmpty()).toBe(true)
      expect(pq.size()).toBe(0)
      expect(pq.peek()).toBeUndefined()
      expect(pq.pop()).toBeUndefined()
    })

    it('should allow adding items after clear', () => {
      pq.push('item1', 1)
      pq.clear()
      pq.push('item2', 2)

      expect(pq.size()).toBe(1)
      expect(pq.peek()).toBe('item2')
    })
  })

  describe('complex scenarios', () => {
    it('should handle mixed operations correctly', () => {
      // Add some items
      pq.push('urgent', 1)
      pq.push('normal', 5)
      pq.push('low', 10)

      // Remove highest priority
      expect(pq.pop()).toBe('urgent')

      // Add more items
      pq.push('critical', 0)
      pq.push('high', 2)

      // Check order
      expect(pq.pop()).toBe('critical') // priority 0
      expect(pq.pop()).toBe('high') // priority 2
      expect(pq.pop()).toBe('normal') // priority 5
      expect(pq.pop()).toBe('low') // priority 10

      expect(pq.isEmpty()).toBe(true)
    })

    it('should handle large number of items', () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({
        value: `item${i}`,
        priority: Math.random() * 1000,
      }))

      // Add all items
      items.forEach(item => pq.push(item.value, item.priority))

      expect(pq.size()).toBe(1000)

      // Remove all items - should come out in priority order
      const results: number[] = []
      while (!pq.isEmpty()) {
        const item = pq.pop()!
        const originalItem = items.find(i => i.value === item)!
        results.push(originalItem.priority)
      }

      // Verify sorted order (ascending priorities)
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBeGreaterThanOrEqual(results[i - 1])
      }
    })

    it('should work with different data types', () => {
      const numberPQ = new BinaryHeapPQ<number>()
      const objectPQ = new BinaryHeapPQ<{ id: number, name: string }>()

      // Test with numbers
      numberPQ.push(42, 2)
      numberPQ.push(24, 1)
      expect(numberPQ.pop()).toBe(24)

      // Test with objects
      const obj1 = { id: 1, name: 'first' }
      const obj2 = { id: 2, name: 'second' }

      objectPQ.push(obj1, 2)
      objectPQ.push(obj2, 1)

      expect(objectPQ.pop()).toBe(obj2)
      expect(objectPQ.pop()).toBe(obj1)
    })
  })

  describe('heap property maintenance', () => {
    it('should maintain heap property after multiple operations', () => {
      // This test ensures the internal heap structure is maintained correctly
      const priorities = [5, 2, 8, 1, 9, 3, 7, 4, 6]
      const values = priorities.map(p => `item${p}`)

      // Add items in random order
      for (let i = 0; i < values.length; i++) {
        pq.push(values[i], priorities[i])
      }

      // Remove items - should come out in ascending priority order
      const sortedPriorities = [...priorities].sort((a, b) => a - b)
      for (const expectedPriority of sortedPriorities) {
        const item = pq.pop()
        expect(item).toBe(`item${expectedPriority}`)
      }

      expect(pq.isEmpty()).toBe(true)
    })
  })
})
