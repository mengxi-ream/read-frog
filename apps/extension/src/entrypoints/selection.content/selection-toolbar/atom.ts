import { atom } from 'jotai'

export const selectionContentAtom = atom<string | null>(null)
export const selectionRangeAtom = atom<Range | null>(null)
export const isSelectionToolbarVisibleAtom = atom<boolean>(false)

// 新增：管理 translate popover 的显示状态
export const isTranslatePopoverVisibleAtom = atom<boolean>(false)
export const isAiPopoverVisibleAtom = atom<boolean>(false)

// 新增：存储鼠标点击位置
export const mouseClickPositionAtom = atom<{ x: number, y: number } | null>(null)
