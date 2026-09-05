import type {
  AutosaveController,
  AutosaveOptions,
  AutosaveDraftSource,
} from "./autosave-controller"
import { createContext, use, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import { createAutosaveController } from "./autosave-controller"

export type AutosaveSession = Pick<
  AutosaveController<object>,
  "edit" | "beginComposition" | "endComposition" | "flush" | "discard" | "subscribe" | "getSnapshot"
> & { registerSource: (key: string, source: AutosaveDraftSource) => () => void }

export const AutosaveContext = createContext<AutosaveSession | null>(null)
export const useOptionalAutosave = () => use(AutosaveContext)
export function useAutosaveContext() {
  const value = useOptionalAutosave()
  if (!value) throw new Error("Autosaved fields require an AutosaveContext")
  return value
}

export function useAutosave<T extends object>(options: AutosaveOptions<T>) {
  const latest = useRef(options)
  useLayoutEffect(() => {
    latest.current = options
  })
  // oxlint-disable-next-line react/refs -- The factory stores callbacks; refs are read only when events/effects invoke them.
  const [controller] = useState(() =>
    createAutosaveController<T>({
      initialValue: options.initialValue,
      getDraft: () => latest.current.getDraft(),
      setField: (key, value) => latest.current.setField(key, value),
      reset: (value) => latest.current.reset(value),
      submit: (revision) => latest.current.submit(revision),
      persist: (snapshot, changes) => latest.current.persist(snapshot, changes),
      delay: options.delay,
    }),
  )
  useLayoutEffect(() => {
    controller.activate()
    return () => controller.deactivate()
  }, [controller])
  return controller
}

export function useAutosaveState(session: Pick<AutosaveSession, "subscribe" | "getSnapshot">) {
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
}

/** Preserve typed form adapters, exposing only string field names to shared UI. */
export function toAutosaveSession<T extends object>(
  controller: AutosaveController<T>,
): AutosaveSession {
  return controller as unknown as AutosaveSession
}
