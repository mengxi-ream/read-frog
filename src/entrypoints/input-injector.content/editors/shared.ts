export interface ReactFiber {
  memoizedState: ReactHook | null
  memoizedProps: Record<string, unknown>
  stateNode: Record<string, unknown> | null
  return: ReactFiber | null
  tag: number
}

export interface ReactHook {
  memoizedState: unknown
  queue: { lastRenderedState: unknown } | null
  next: ReactHook | null
}

export function findReactFiber(element: Element): ReactFiber | null {
  const key = Object.keys(element).find(k => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"))
  return key ? (element as unknown as Record<string, ReactFiber>)[key] : null
}
