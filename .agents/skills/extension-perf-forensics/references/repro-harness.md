# Repro Harness

A Puppeteer + real-Chrome harness that loads the built extension, force-enables the feature under test, scripts the reported interaction, and samples metrics into JSONL. One script, three modes: extension run, no-extension control (`CONTROL=1`), snapshot-free timing run (`SKIP_SNAPSHOTS=1`).

## Launching with the extension (Chrome ≥137)

`--load-extension` is ignored by branded Chrome ≥137. Use the CDP extension API:

```js
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false,
  pipe: true,                 // required for installExtension
  enableExtensions: true,     // adds --enable-unsafe-extension-debugging
  userDataDir: PROFILE_DIR,   // one dir PER experiment mode
  defaultViewport: null,
  protocolTimeout: 300000,
  args: ['--no-first-run', '--no-default-browser-check', '--window-size=1440,900'],
})
const extId = await browser.installExtension(EXT_PATH) // .output/chrome-mv3
```

`installExtension` does **not** persist across sessions — call it every run, even on a reused profile.

## Force-enabling the feature (config patching, with race guards)

Patch the extension's storage from its service worker target. The extension's own init/migrations/onboarding pages can overwrite your patch seconds later, so: patch → settle → re-assert → verify. Never navigate before `verified === true`, and dump the config again after the run before trusting any conclusion.

```js
const swTarget = await browser.waitForTarget(
  (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'),
  { timeout: 30000 },
)
const sw = await swTarget.worker()
const patchOnce = () => sw.evaluate(async () => {
  const { config } = await chrome.storage.local.get('config')
  if (!config) return null
  let dirty = false
  // pin EVERYTHING the experiment depends on, not just the trigger:
  if (!config.translate.page.autoTranslatePatterns.includes('example.com')) {
    config.translate.page.autoTranslatePatterns.push('example.com'); dirty = true
  }
  if (config.language.targetCode !== 'cmn') { config.language.targetCode = 'cmn'; dirty = true }
  if (dirty) await chrome.storage.local.set({ config })
  return config.translate.providerId
})
let provider = null
for (let i = 0; i < 30 && !provider; i++) { provider = await patchOnce(); if (!provider) await sleep(1000) }
await sleep(5000)      // let init/migrations settle…
await patchOnce()      // …then re-assert
const verified = await sw.evaluate(async () => {
  const { config } = await chrome.storage.local.get('config')
  return config?.translate?.page?.autoTranslatePatterns?.includes('example.com')
    && config?.language?.targetCode === 'cmn'
})
if (!verified) throw new Error('config patch did not stick')
```

## Instrumentation injected before the page loads

`evaluateOnNewDocument` runs before site scripts — install counters the samples will read:

```js
await page.evaluateOnNewDocument(() => {
  // long tasks = main-thread blocking evidence
  window.__lt = { count: 0, max: 0, total: 0 }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__lt.count++; window.__lt.total += e.duration
        if (e.duration > window.__lt.max) window.__lt.max = e.duration
      }
    }).observe({ entryTypes: ['longtask'] })
  } catch {}
  // domain churn counter: how often does OUR OWN artifact get inserted/removed?
  window.__churn = { adds: 0, removals: 0 }
  const count = (n) => n.nodeType !== 1 ? 0
    : (n.classList?.contains('my-extension-artifact') ? 1 : 0)
      + (n.querySelectorAll?.('.my-extension-artifact').length ?? 0)
  document.addEventListener('DOMContentLoaded', () => {
    new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes) window.__churn.adds += count(n)
        for (const n of r.removedNodes) window.__churn.removals += count(n)
      }
    }).observe(document.documentElement, { childList: true, subtree: true })
  })
})
```

Churn counters answer the question metrics can't: "inserted 2,451 times for a page that needs ~800" is a re-render storm even when the end state looks fine.

## Sampling loop

Every probe that runs in the page must be raced against a timeout — hangs ARE data (freeze evidence), not errors:

```js
const withTimeout = (p, ms, label) => Promise.race([
  p.then((v) => ({ ok: true, value: v })),
  new Promise((r) => setTimeout(() => r({ ok: false, hang: label }), ms)),
])

async function getMetrics(cdp) {           // CDP: works via a separate channel
  const res = await withTimeout(cdp.send('Performance.getMetrics'), 15000, 'metrics')
  if (!res.ok) return null
  const m = Object.fromEntries(res.value.metrics.map((x) => [x.name, x.value]))
  return {
    heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1),
    nodes: m.Nodes,                        // ALL nodes incl. detached-but-referenced
    listeners: m.JSEventListeners,
    layoutCount: m.LayoutCount,
    recalcStyleCount: m.RecalcStyleCount,
    taskDurationS: +m.TaskDuration.toFixed(1),
  }
}
async function countMarkers(page) {        // in-page: hangs when main thread is pegged
  const res = await withTimeout(page.evaluate(() => ({
    artifacts: document.querySelectorAll('.my-extension-artifact').length,
    allNodes: document.getElementsByTagName('*').length,  // ATTACHED elements only
    adds: window.__churn?.adds, removals: window.__churn?.removals,
    longTasks: window.__lt?.count, longTaskTotalMs: Math.round(window.__lt?.total ?? -1),
  })), 15000, 'markers')
  return res.ok ? res.value : null
}
```

Run shape: `baseline (settle → forceGC → sample → snapshot)` → `N interaction cycles (scroll/click script, sample each)` → `idle watch (30s, sample every 3s — growth at idle = self-sustaining loop)` → `final (2× forceGC → sample → snapshot)`. Force GC via `cdp.send('HeapProfiler.collectGarbage')`. Write every record as a JSONL line; the analysis step greps these.

## Freeze tolerance

On a badly broken build the page can lock up during initial load — the harness must record that instead of dying:

- never `throw` on a hung probe; log `main_thread_hung` and continue polling;
- don't `page.reload()` on a frozen page (navigation will time out and kill the run);
- wrap snapshots in a generous timeout and log `snapshot_hang` — "heap snapshot impossible" is itself a headline result;
- abort interaction cycles after 2 consecutive hangs, then still attempt idle-watch and final metrics (CDP metrics usually still respond).

## Pass-criteria table

Fixes are judged against recorded baselines, e.g.:

| Metric | broken | control | pass criteria |
|---|---|---|---|
| CDP Nodes after cycles | 1.33M | 177k | same order as control |
| TaskDuration total | 840s | 10.7s | same order as control |
| probes hung >45s | every cycle | 0 | 0 |
| heap after 2×GC | unmeasurable | +0.8MB | < +5MB |
| artifact churn (adds vs needed) | 2451 / ~800 | — | ≈1 insert per needed artifact |
| feature still works (artifact count) | 0 (vanished) | — | grows with interaction, persists |

The last row matters: a "fix" that zeroes the churn by breaking the feature passes every perf number.
