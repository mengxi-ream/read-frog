import type { SubtitlesFragment } from "@/utils/subtitles/types"

interface DomLiveCaptureOptions {
  readText: () => string
  currentTimeMs: () => number
  onFragments: (fragments: SubtitlesFragment[]) => void
}

export function startDomLiveCapture({ readText, currentTimeMs, onFragments }: DomLiveCaptureOptions): () => void {
  let active: SubtitlesFragment | null = null
  const emit = () => {
    const text = readText()
    const now = currentTimeMs()
    if (!text) {
      if (active)
        onFragments([{ ...active, end: Math.max(active.start + 250, now) }])
      active = null
      return
    }
    if (active?.text === text) {
      active = { ...active, end: now + 1_000 }
      onFragments([active])
      return
    }
    const closed = active ? [{ ...active, end: Math.max(active.start + 250, now) }] : []
    active = { text, start: now, end: now + 1_000 }
    onFragments([...closed, active])
  }

  const observer = new MutationObserver(emit)
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  const intervalId = window.setInterval(emit, 500)
  emit()

  return () => {
    observer.disconnect()
    window.clearInterval(intervalId)
  }
}
