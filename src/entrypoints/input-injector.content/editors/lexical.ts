interface LexicalSelection {
  insertRawText: (text: string) => void
}

interface LexicalRoot {
  getChildrenSize: () => number
  select: (anchorOffset: number, focusOffset: number) => LexicalSelection
}

interface LexicalEditor {
  getRootElement: () => HTMLElement | null
  getEditorState: () => { _nodeMap: Map<string, LexicalRoot> }
  update: (callback: () => void, options: { tag: string; discrete: boolean }) => void
}

function getEditor(element: Element): LexicalEditor | null {
  const editor = (element as Element & { __lexicalEditor?: LexicalEditor }).__lexicalEditor
  if (
    !editor ||
    typeof editor.update !== "function" ||
    typeof editor.getEditorState !== "function" ||
    typeof editor.getRootElement !== "function" ||
    editor.getRootElement() !== element
  ) {
    return null
  }
  return editor
}

export function isLexicalElement(element: Element): boolean {
  return element.getAttribute("data-lexical-editor") === "true" || !!getEditor(element)
}

export function replaceLexical(element: Element, text: string): boolean {
  const editor = getEditor(element)
  if (!editor) return false

  // Use the page's own node instances: importing another copy of Lexical would
  // access a different active-editor context. These are the two private bridges
  // (__lexicalEditor and _nodeMap); the actual mutation uses its editor/node APIs.
  const root = editor.getEditorState()._nodeMap?.get("root")
  if (!root || typeof root.select !== "function" || typeof root.getChildrenSize !== "function") {
    return false
  }

  let replaced = false
  editor.update(
    () => {
      const selection = root.select(0, root.getChildrenSize())
      // insertRawText preserves line breaks and tabs in translated input.
      selection.insertRawText(text)
      replaced = true
    },
    // Keep replacement as one undo step, separate from the user's typing.
    { tag: "history-push", discrete: true },
  )
  return replaced
}
