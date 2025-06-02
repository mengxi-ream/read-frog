// import { describe, it } from 'vitest'
// import { RequestQueue } from '../request-queue'

// describe('requestQueue', () => {
//   it('should create a new request queue', { timeout: 100000 }, async () => {
//     const queue = new RequestQueue({
//       rate: 0.2,
//       capacity: 1,
//       timeoutMs: 1000,
//       maxRetries: 3,
//       baseRetryDelayMs: 100,
//     })

//     const result = await queue.enqueue(() => Promise.resolve('result'), Date.now(), 'hash')
//     console.log(result)
//     const result2 = await queue.enqueue(() => Promise.resolve('result2'), Date.now(), 'hash')
//     console.log(result2)
//     queue.enqueue(() => Promise.resolve('result3'), Date.now(), 'hash').then(console.log)
//     queue.enqueue(() => Promise.resolve('result4'), Date.now(), 'hash').then(console.log)
//     expect(result).toBe('result')
//   })
// })
