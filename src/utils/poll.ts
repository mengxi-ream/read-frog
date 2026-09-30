import { sleep } from "./sleep"

export async function pollUntil<T>(
  read: () => T | null | undefined | Promise<T | null | undefined>,
  { timeoutMs, intervalMs }: { timeoutMs: number; intervalMs: number },
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs
  while (true) {
    const value = await read()
    if (value !== null && value !== undefined) {
      return value
    }
    if (Date.now() >= deadline) {
      return null
    }
    await sleep(intervalMs)
  }
}
