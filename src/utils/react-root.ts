import type { ReactNode } from "react"
import type { Root } from "react-dom/client"
import { createRoot } from "react-dom/client"

const REACT_ROOT_REGISTRY_KEY = Symbol.for("read-frog.react-root-registry")

type RootRegistryHost = typeof globalThis & {
  [REACT_ROOT_REGISTRY_KEY]?: WeakMap<HTMLElement, Root>
}

function getRootRegistry(): WeakMap<HTMLElement, Root> {
  const rootRegistryHost = globalThis as RootRegistryHost
  // Persistent extension pages can re-run their entrypoint during HMR without
  // recreating the DOM container, so keep the root registry above module scope.
  rootRegistryHost[REACT_ROOT_REGISTRY_KEY] ??= new WeakMap<HTMLElement, Root>()
  return rootRegistryHost[REACT_ROOT_REGISTRY_KEY]
}

export function renderPersistentReactRoot(container: HTMLElement, app: ReactNode): Root {
  const rootRegistry = getRootRegistry()
  const existingRoot = rootRegistry.get(container)

  if (existingRoot) {
    existingRoot.render(app)
    return existingRoot
  }

  const root = createRoot(container)
  rootRegistry.set(container, root)
  root.render(app)
  return root
}

export function unmountPersistentReactRoot(container: HTMLElement): void {
  const rootRegistry = getRootRegistry()
  const root = rootRegistry.get(container)

  if (!root) {
    return
  }

  root.unmount()
  rootRegistry.delete(container)
}
