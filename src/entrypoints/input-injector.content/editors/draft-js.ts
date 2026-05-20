interface ReactFiber {
  memoizedState: ReactHook | null
  memoizedProps: Record<string, unknown>
  stateNode: Record<string, unknown> | null
  return: ReactFiber | null
  tag: number
}

interface ReactHook {
  memoizedState: unknown
  queue: { lastRenderedState: unknown } | null
  next: ReactHook | null
}

interface DraftEditorState {
  getCurrentContent: () => DraftContentState
  getSelection: () => DraftSelectionState
}

interface DraftContentState {
  getPlainText: () => string
  getBlockMap: () => unknown
}

interface DraftSelectionState {
  getAnchorKey: () => string
}

function isDraftEditorState(value: unknown): value is DraftEditorState {
  return !!value
    && typeof value === "object"
    && typeof (value as DraftEditorState).getCurrentContent === "function"
    && typeof (value as DraftEditorState).getSelection === "function"
}

export function isDraftElement(element: Element): boolean {
  return !!element.closest(".DraftEditor-root")
}

// Draft.js editor components store { editorState, onChange } in their props
// or manage EditorState in a parent component's React state.
function findDraftEditor(element: Element): { editorState: DraftEditorState, onChange: (state: DraftEditorState) => void } | null {
  const contentEl = element.closest(".public-DraftEditor-content") ?? element
  const fiberKey = Object.keys(contentEl).find(key => key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$"))
  if (!fiberKey)
    return null

  let fiber: ReactFiber | null = (contentEl as unknown as Record<string, ReactFiber>)[fiberKey]
  while (fiber) {
    const props = fiber.memoizedProps
    if (props && isDraftEditorState(props.editorState) && typeof props.onChange === "function") {
      return {
        editorState: props.editorState as DraftEditorState,
        onChange: props.onChange as (state: DraftEditorState) => void,
      }
    }

    // Also check stateNode for class components
    const stateNode = fiber.stateNode as Record<string, unknown> | null
    const stateNodeProps = (stateNode?.props ?? {}) as Record<string, unknown>
    if (isDraftEditorState(stateNodeProps.editorState)) {
      return {
        editorState: stateNodeProps.editorState as DraftEditorState,
        onChange: stateNodeProps.onChange as (state: DraftEditorState) => void,
      }
    }

    fiber = fiber.return
  }

  return null
}

export function replaceDraft(element: Element, text: string): boolean {
  const editor = findDraftEditor(element)
  if (!editor)
    return false

  const { editorState, onChange } = editor
  const contentState = editorState.getCurrentContent()

  // Access Draft.js internals through the global module
  // Draft.js exposes ContentState.createFromText and EditorState.push
  // We need to find these constructors from the existing instances
  const EditorStateProto = Object.getPrototypeOf(editorState)
  const EditorStateConstructor = EditorStateProto.constructor

  // Draft.js's EditorState has a static `push` method and ContentState has `createFromText`
  const ContentStateProto = Object.getPrototypeOf(contentState)
  const ContentStateConstructor = ContentStateProto.constructor

  if (typeof ContentStateConstructor.createFromText !== "function" || typeof EditorStateConstructor.push !== "function")
    return false

  const newContent = ContentStateConstructor.createFromText(text)
  const newEditorState = EditorStateConstructor.push(editorState, newContent, "insert-characters")

  // Move cursor to end
  if (typeof EditorStateConstructor.moveSelectionToEnd === "function") {
    const finalState = EditorStateConstructor.moveSelectionToEnd(newEditorState)
    onChange(finalState)
  }
  else {
    onChange(newEditorState)
  }

  return true
}
