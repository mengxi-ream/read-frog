export async function delay(intervalMs: number) {
  await new Promise(resolve => setTimeout(resolve, intervalMs))
}
