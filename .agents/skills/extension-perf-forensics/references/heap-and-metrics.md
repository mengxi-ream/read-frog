# Heap & Metrics Interpretation

## Metric semantics (the two node counts are different on purpose)

| Metric | Source | Meaning |
|---|---|---|
| `Nodes` | CDP `Performance.getMetrics` | ALL DOM nodes the renderer holds, **including detached-but-referenced ones**, across frames |
| `allNodes` | in-page `getElementsByTagName('*').length` | attached elements in the main document only |
| `JSHeapUsedSize` | CDP | JS heap; only meaningful **after forced GC** (`HeapProfiler.collectGarbage`) |
| `JSEventListeners` | CDP | live listener count — a leak of handlers shows here even when heap looks flat |
| `LayoutCount` / `RecalcStyleCount` | CDP | how often the renderer laid out / recalced style — the key to the detached-DOM signature |
| `TaskDuration` | CDP | cumulative main-thread task time — the honest "how busy was this page" number |

## Failure signatures

| Observation | Diagnosis | Next tool |
|---|---|---|
| heap grows after forced GC, DOM counts flat | JS-side retention (real leak) | heap snapshots + memlab retainers |
| CDP `Nodes` explodes; `allNodes` flat; **layout/style counters frozen** | a JS loop building/discarding **detached** DOM at full speed (never renders, so nothing invalidates) | CPU profile (see starved-renderer-profiling) |
| `Nodes` oscillates up and down in waves; heap stable | allocation churn being GC'd — not a leak, but CPU waste | churn counters; find who allocates |
| listeners climb monotonically | handler leak (UI mounted per item, never unmounted) | grep mount paths; check unmount on site-driven removal |
| everything stable but TaskDuration ≫ control | pure CPU overhead | CPU profile / count your per-mutation work |
| artifact adds ≫ artifacts needed; removals trail adds for minutes | rebuild/teardown storm or slow-queue draining | churn counters per cycle + queue inspection |

Also watch for **non-determinism**: storm-intensity-dependent failures can pass on a lucky run. Re-run the broken build before believing a fix.

## Heap snapshots over CDP

```js
async function takeHeapSnapshot(cdp, file) {
  const ws = fs.createWriteStream(file)
  const onChunk = (e) => ws.write(e.chunk)
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk)
  const res = await withTimeout(
    cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false }), 180000, 'snapshot')
  cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk)
  await new Promise((r) => ws.end(r))
  return res.ok
}
```

- Snapshot **pauses the world** — never mix snapshot runs with timing measurements; a mutation backlog processed after a 2-minute snapshot can fake a freeze.
- "Snapshot hung" on a pegged main thread is itself a result — log it, don't retry forever.
- Take three when hunting retention: baseline (after settle+GC), target (after interactions+GC), final (after revert/idle+GC).

## memlab (never read .heapsnapshot files raw — they're hundreds of MB)

```bash
npx memlab find-leaks --baseline baseline.heapsnapshot --target target.heapsnapshot \
  --final final.heapsnapshot --work-dir memlab-out          # clustered leaks + retainer traces
npx memlab analyze detached-DOM --snapshot final.heapsnapshot # all detached elements w/ sizes
```

Reading retainer traces:
- your artifact's class name inside a `Detached <element>` line = your DOM retained by someone — walk the chain upward to the owner (closure variable, Map entry, listener);
- site-owned scripts (ad/analytics closures) also retain detached nodes — don't claim those; the **no-extension control** tells you the site's baseline detached population;
- `WeakMap`/`WeakSet` edges do NOT retain — if the only path is through a WeakMap, the key is exonerated;
- signature of "many small things leaked per item": tens of thousands of `closure` nodes + MBs of `ExternalStringData` (strings you generated per item, e.g. translations/HTML snapshots).

## Retention patterns worth grepping for in extension code

- **Module-level strong `Map<Element, …>`** caches — entries survive site-driven node removal forever. WeakMap unless you must enumerate.
- **UI roots mounted into page DOM** (error badges, tooltips): if the site removes the subtree, your unmount path never runs; anything the component subscribed to (`window.matchMedia` listeners, global store subscriptions) pins the whole tree. Sweep removedNodes in your MutationObserver and unmount there.
- **Infinite Web Animations**: `el.animate(..., { iterations: Infinity })` — a running animation roots its detached target. `el.getAnimations().forEach(a => a.cancel())` before every `.remove()` path.
- **Grow-only arrays of observers** (`this.observers.push(...)` per subtree with no dedup) — WeakSet of observed roots.
