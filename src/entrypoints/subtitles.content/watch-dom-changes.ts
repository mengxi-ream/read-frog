/** Calls back at most once a frame while the page changes, for controls a site keeps rebuilding. */
export function watchDomChanges(onChanged: () => void): () => void {
  let scheduled = false
  const observer = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      onChanged()
    })
  })
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
