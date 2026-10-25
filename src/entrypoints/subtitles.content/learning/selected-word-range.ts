import type { WordRange } from "./atoms"
import { readSelectionSnapshot } from "@/entrypoints/selection.content/utils"

/**
 * The words the page's text selection covers inside a subtitle line, snapped
 * out to whole words. Null when nothing is selected or the selection reaches
 * outside the line.
 */
export function getSelectedWordRange(line: HTMLElement): WordRange | null {
  const selected = readSelectionSnapshot(window.getSelection())?.ranges[0]
  if (
    !selected ||
    !line.contains(selected.startContainer) ||
    !line.contains(selected.endContainer)
  ) {
    return null
  }

  const range = document.createRange()
  range.setStart(selected.startContainer, selected.startOffset)
  range.setEnd(selected.endContainer, selected.endOffset)

  const indexes = [...line.querySelectorAll<HTMLElement>('[data-slot="subtitle-word"]')]
    .filter((word) => range.intersectsNode(word))
    .map((word) => Number(word.dataset.index))
  const start = indexes[0]
  const end = indexes.at(-1)
  return start === undefined || end === undefined ? null : { start, end }
}
