/**
 * Start promises in batches, waiting intervalMs after each batch before starting the next one.
 * Finally use Promise.all to wait for all promises to complete.
 * @param {Array<() => Promise<T>>} promiseFns Functions that generate promises when called
 * @param {number} batchSize Number of promises to start in each batch
 * @param {number} intervalMs Interval between batches (milliseconds)
 * @returns {Promise<Awaited<T>[]>} results of all promises
 */
export async function sendInBatchesWithFixedDelay<T>(
  promiseFns: Promise<T>[],
  batchSize = 8,
  intervalMs = 5000,
) {
  const allPromises: Promise<T>[] = []

  for (let i = 0; i < promiseFns.length; i += batchSize) {
    // Start this batch, but don't await them
    const batch = promiseFns.slice(i, i + batchSize)
    batch.forEach((fn) => {
      allPromises.push(fn)
    })

    // After starting this batch, wait intervalMs before proceeding to the next batch
    if (i + batchSize < promiseFns.length) {
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
  }

  // All promises have been started, collect their results
  return Promise.all(allPromises)
}
