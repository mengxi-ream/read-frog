import { dequal } from "dequal"

export type FlushResult = "saved" | "unchanged" | "invalid" | "failed"
export interface AutosaveState {
  dirty: boolean
  busy: boolean
  composing: boolean
  error: "invalid" | "failed" | "deleted" | null
}

/** Raw editor text can be invalid even while the form still contains a valid value. */
export interface AutosaveDraftSource {
  isDirty: () => boolean
  prepare: () => boolean
  snapshot: () => string
  acknowledge: (snapshot: string) => void
  reset: (value: unknown) => void
}

export interface AutosaveOptions<T extends object> {
  initialValue: T
  getDraft: () => T
  setField: (key: keyof T, value: T[keyof T]) => void
  reset: (value: T) => void
  submit: (revision: number) => Promise<void>
  persist: (snapshot: T, changes: Partial<T>) => Promise<void>
  delay?: number
}

function keys<T extends object>(value: T): (keyof T)[] {
  return Object.keys(value) as (keyof T)[]
}

/** Top-level objects/arrays are logical fields; undefined deliberately removes a field. */
export function changedFields<T extends object>(baseline: T, draft: T): Partial<T> {
  const changes: Partial<T> = {}
  for (const key of new Set([...keys(baseline), ...keys(draft)])) {
    if (!dequal(baseline[key], draft[key])) changes[key] = draft[key]
  }
  return changes
}

/** One controller per entity. It schedules commits, never owns the editable form values. */
export function createAutosaveController<T extends object>(options: AutosaveOptions<T>) {
  let baseline = structuredClone(options.initialValue)
  let external: T | undefined = baseline
  let revision = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let busy = false
  let ready = false
  let active = true
  let discarding = false
  let flushRequested = false
  let running: Promise<void> | undefined
  let outcome: FlushResult | undefined
  let inFlightChanges: Partial<T> | undefined
  let error: AutosaveState["error"] = null
  const composing = new Set<string>()
  const sources = new Map<keyof T, AutosaveDraftSource>()
  const listeners = new Set<() => void>()
  const waiters: ((result: FlushResult) => void)[] = []
  let state: AutosaveState = { dirty: false, busy: false, composing: false, error: null }

  const isDirty = () =>
    Object.keys(changedFields(baseline, options.getDraft())).length > 0 ||
    [...sources.values()].some((source) => source.isDirty())

  function publish() {
    const next = { dirty: isDirty(), busy, composing: composing.size > 0, error }
    if (dequal(state, next)) return
    state = next
    listeners.forEach((listener) => listener())
  }

  function cancelTimer() {
    clearTimeout(timer)
    timer = undefined
  }

  function settle(result: FlushResult) {
    flushRequested = false
    waiters.splice(0).forEach((resolve) => resolve(result))
  }

  function schedule(immediate = false) {
    cancelTimer()
    ready = false
    if (!active || discarding || !external) return
    if (composing.size > 0) return
    if (immediate || flushRequested) {
      ready = true
      void drain()
    } else {
      timer = setTimeout(() => {
        timer = undefined
        ready = true
        void drain()
      }, options.delay ?? 500)
    }
  }

  async function drain() {
    if (!active || discarding || busy || !ready || composing.size > 0) return
    ready = false
    if (!external) {
      error = "deleted"
      publish()
      settle("failed")
      return
    }
    // Parse the latest raw text before validation; never submit a stale debounced value.
    const before = options.getDraft()
    let valid = true
    for (const source of sources.values()) {
      if (!source.prepare()) valid = false
    }
    if (!dequal(before, options.getDraft())) revision++
    if (!valid) {
      error = "invalid"
      publish()
      settle("invalid")
      return
    }
    if (!isDirty()) {
      error = null
      publish()
      settle("unchanged")
      return
    }

    busy = true
    error = null
    outcome = undefined
    const ticket = revision
    publish()
    // Deferring invocation lets running be installed before onSubmit can run.
    running = Promise.resolve().then(() => options.submit(ticket))
    try {
      await running
      if (!discarding && ticket === revision && !composing.size && !outcome) {
        outcome = "invalid" // TanStack validation prevented onSubmit.
        error = "invalid"
      }
    } catch {
      outcome = "failed"
      error = external ? "failed" : "deleted"
    } finally {
      busy = false
      running = undefined
      inFlightChanges = undefined
      publish()
      if (discarding || !active) {
        // Lifecycle cleanup owns settlement while detached/discarding.
      } else if (ticket === revision && (outcome === "failed" || outcome === "invalid")) {
        ready = false
        cancelTimer()
        settle(outcome)
      } else if (!isDirty() && !composing.size) {
        ready = false
        cancelTimer()
        settle(outcome ?? "unchanged")
      } else if (ready || flushRequested) {
        ready = true
        void drain()
      }
    }
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => state,
    edit(update: () => void, settings?: { immediate?: boolean }) {
      const before = options.getDraft()
      const rawBefore = [...sources.values()].map((source) => source.snapshot())
      update()
      // Explicit commands (e.g. applying recommended JSON) replace the raw editor
      // too. External reconciliation intentionally does not take this path.
      const after = options.getDraft()
      for (const [key, source] of sources) {
        if (!dequal(before[key], after[key])) source.reset(after[key])
      }
      const rawAfter = [...sources.values()].map((source) => source.snapshot())
      if (dequal(before, options.getDraft()) && dequal(rawBefore, rawAfter)) return
      revision++
      error = external ? null : "deleted"
      publish()
      schedule(settings?.immediate)
    },
    beginComposition(fieldId: string) {
      composing.add(fieldId)
      revision++ // Invalidates validation that began before this composition session.
      cancelTimer()
      ready = false
      publish()
    },
    endComposition(fieldId: string, update: () => void) {
      update()
      composing.delete(fieldId)
      revision++
      publish()
      schedule()
    },
    flush(): Promise<FlushResult> {
      if (!external) return Promise.resolve("failed")
      if (!active || discarding) return Promise.resolve("unchanged")
      flushRequested = true
      const result = new Promise<FlushResult>((resolve) => waiters.push(resolve))
      schedule(true)
      return result
    },
    /** Called only by TanStack onSubmit, after all field/form validation has passed. */
    async commit(value: T, ticket: number) {
      if (!active || discarding || composing.size || ticket !== revision || !external) return
      const snapshot = structuredClone(value)
      const changes = changedFields(baseline, snapshot)
      const raw = new Map([...sources].map(([key, source]) => [key, source.snapshot()]))
      inFlightChanges = changes
      if (Object.keys(changes).length > 0) {
        await options.persist(snapshot, changes)
        baseline = { ...baseline, ...changes }
        if (external) external = { ...external, ...changes }
        outcome = "saved"
      } else {
        outcome = "unchanged"
      }
      for (const [key, text] of raw) sources.get(key)?.acknowledge(text)
      publish()
    },
    reconcile(next: T | undefined) {
      external = next === undefined ? undefined : structuredClone(next)
      if (!next) {
        revision++
        error = "deleted"
        cancelTimer()
        ready = false
        publish()
        if (!busy) settle("failed")
        return
      }
      const draft = options.getDraft()
      let changed = false
      for (const key of new Set([...keys(baseline), ...keys(next)])) {
        // An optimistic echo is not a persistence acknowledgement.
        if (inFlightChanges && Object.hasOwn(inFlightChanges, key)) continue
        if (sources.get(key)?.isDirty()) continue
        if (dequal(draft[key], baseline[key]) || dequal(draft[key], next[key])) {
          if (!dequal(draft[key], next[key])) {
            options.setField(key, next[key])
            changed = true
          }
          baseline = { ...baseline, [key]: next[key] }
        }
      }
      if (changed) {
        revision++
        if (isDirty()) schedule(flushRequested)
      }
      publish()
    },
    registerSource(key: keyof T, source: AutosaveDraftSource) {
      sources.set(key, source)
      publish()
      return () => {
        if (sources.get(key) === source) sources.delete(key)
      }
    },
    async discard() {
      discarding = true
      cancelTimer()
      ready = false
      composing.clear()
      revision++
      await running?.catch(() => {})
      if (external) {
        baseline = structuredClone(external)
        options.reset(baseline)
        for (const [key, source] of sources) source.reset(baseline[key])
      }
      error = external ? null : "deleted"
      discarding = false
      settle("unchanged")
      publish()
    },
    activate() {
      active = true
    },
    deactivate() {
      active = false
      cancelTimer()
      ready = false
      settle("unchanged")
    },
  }
}

export type AutosaveController<T extends object> = ReturnType<typeof createAutosaveController<T>>
