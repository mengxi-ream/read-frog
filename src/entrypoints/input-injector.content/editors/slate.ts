interface ReactFiber {
  memoizedState: ReactHook | null
  return: ReactFiber | null
}

interface ReactHook {
  memoizedState: unknown
  next: ReactHook | null
}

interface SlateEditor {
  children: SlateNode[]
  selection: { anchor: SlatePoint, focus: SlatePoint } | null
  apply: (op: Record<string, unknown>) => void
  insertText: (text: string) => void
}

interface SlatePoint {
  path: number[]
  offset: number
}

type SlateNode = SlateElement | SlateText
interface SlateElement { children: SlateNode[], text?: undefined }
interface SlateText { text: string, children?: undefined }

// Slate's createEditor() returns an object with apply(), insertText(), and
// children[]. This combination is unique to Slate's Editor interface — no
// other common React hook state has all three.
// See: https://github.com/ianstormtaylor/slate/blob/main/packages/slate/src/interfaces/editor.ts
function isSlateEditor(value: unknown): value is SlateEditor {
  return !!value
    && typeof value === "object"
    && typeof (value as SlateEditor).apply === "function"
    && typeof (value as SlateEditor).insertText === "function"
    && Array.isArray((value as SlateEditor).children)
}

function getEditorFromElement(element: Element): SlateEditor | null {
  const fiberKey = Object.keys(element).find(key => key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$"))
  if (!fiberKey)
    return null
  return findSlateEditor((element as unknown as Record<string, ReactFiber>)[fiberKey])
}

export function isSlateElement(element: Element): boolean {
  return element.getAttribute("data-slate-editor") === "true" || !!getEditorFromElement(element)
}

function findSlateEditor(fiber: ReactFiber): SlateEditor | null {
  let currentFiber: ReactFiber | null = fiber
  while (currentFiber) {
    let hook = currentFiber.memoizedState
    while (hook) {
      if (isSlateEditor(hook.memoizedState))
        return hook.memoizedState
      hook = hook.next
    }
    currentFiber = currentFiber.return
  }
  return null
}

function findLeafPath(node: SlateNode, path: number[], first: boolean): number[] | null {
  if ("text" in node && typeof node.text === "string")
    return path
  const children = (node as SlateElement).children
  if (!children || !children.length)
    return null
  const index = first ? 0 : children.length - 1
  return findLeafPath(children[index], path.concat(index), first)
}

export function replaceSlate(element: Element, text: string): boolean {
  const editor = getEditorFromElement(element)
  if (!editor)
    return false

  const startPath = findLeafPath({ children: editor.children } as SlateElement, [], true)
  const endPath = findLeafPath({ children: editor.children } as SlateElement, [], false)
  if (!startPath || !endPath)
    return false

  let endNode: SlateNode = { children: editor.children } as SlateElement
  for (let i = 0; i < endPath.length; i++)
    endNode = (endNode as SlateElement).children[endPath[i]]

  editor.apply({
    type: "set_selection",
    properties: editor.selection,
    newProperties: {
      anchor: { path: startPath, offset: 0 },
      focus: { path: endPath, offset: (endNode as SlateText).text.length },
    },
  })
  editor.insertText(text)
  return true
}
