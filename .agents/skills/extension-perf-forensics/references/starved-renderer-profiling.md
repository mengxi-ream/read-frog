# Profiling a Starved Renderer

## Symptoms

- in-page probes (`page.evaluate`) hit their timeout race every time;
- `Profiler.start` / `Runtime.evaluate` never return (even with minutes of protocolTimeout) — renderer-targeted CDP commands queue behind the busy main thread;
- `Performance.getMetrics` still answers, `TaskDuration` climbs ~1s per wall-clock second;
- if layout/style counters are frozen while `Nodes` churns: the loop runs entirely on detached DOM (nothing invalidates rendering, so the cached layout is served and the loop is pure CPU).

## Capture via the Tracing domain (browser process — immune to renderer starvation)

Start tracing **before** navigation; stop is handled by the browser process, so it works while the renderer spins:

```js
const page = await browser.newPage()
await page.tracing.start({
  path: 'churn.trace.json',
  categories: [
    '-*',
    'toplevel',
    'v8.execute',
    'disabled-by-default-v8.cpu_profiler',   // embeds sampling profiles in the trace
    'devtools.timeline',
  ],
})
await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
await sleep(30000)              // let the churn develop while sampling
await page.tracing.stop()       // browser-process; returns even when renderer is pegged
```

## Extract the top frames from the trace

`Profile` / `ProfileChunk` events carry standard cpuprofile fragments per `pid:tid:id`; merge chunks and rank self-time by sample counts:

```js
const trace = JSON.parse(fs.readFileSync('churn.trace.json', 'utf8'))
const profiles = new Map()
for (const e of trace.traceEvents) {
  const key = `${e.pid}:${e.tid}:${e.id}`
  if (e.name === 'Profile') profiles.set(key, { nodes: [], samples: [] })
  else if (e.name === 'ProfileChunk') {
    const p = profiles.get(key) ?? { nodes: [], samples: [] }
    profiles.set(key, p)
    const cpu = e.args?.data?.cpuProfile
    if (cpu?.nodes) p.nodes.push(...cpu.nodes)
    if (cpu?.samples) p.samples.push(...cpu.samples)
  }
}
const { nodes, samples } = [...profiles.values()].sort((a, b) => b.samples.length - a.samples.length)[0]
const byId = new Map(nodes.map((n) => [n.id, n]))
const hits = new Map()
for (const s of samples) hits.set(s, (hits.get(s) ?? 0) + 1)
for (const [id, n] of [...hits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([id, h]) => [id, h])) {
  const f = byId.get(id)?.callFrame ?? {}
  // keep the FULL url — you need it to fetch the bundle; also print a short
  // ancestor chain (walk .parent) — minified leaf names alone are useless.
  console.log(((n / samples.length) * 100).toFixed(1) + '%', f.functionName || '(anon)', f.url, f.lineNumber, f.columnNumber)
}
```

## Attribute the frames

- Frames in `chrome-extension://…` files → your code. Column offsets map into your built bundle.
- Frames in a **site-hashed bundle** (`https://…/app.abc123.js`) → the SITE's code is the hot loop. The stack shape often identifies the library (jQuery: `css/attr/prepend` + `T.fn.<computed>`).
- Minified names mean nothing — fetch the bundle and cut a window around the hot column offsets:

```js
// Cloudflare blocks curl and fresh headless profiles. Grab the asset from a
// real page load via response interception instead:
page.on('response', async (res) => {
  if (res.url().includes('abc123')) body = await res.text().catch(() => null)
})
await page.goto(SITE_URL, { waitUntil: 'networkidle2' }).catch(() => {})
fs.writeFileSync('site-bundle.js', body)
// then: src.slice(col - 200, col + 400) around each hot offset — method names
// and string literals in the window usually identify the feature (e.g. a
// navbar overflow handler: `while (this.menuIsOverflowing()) this.moveSingleMainItemToExtras()`).
```

## Confirm site-vs-extension with paired experiments

When the hot frames are the site's, prove the interaction both ways before writing the fix:

1. **No extension + hand-made trigger**: reproduce what the extension does to the DOM with a one-line evaluate (append text to widen elements, etc.). If the site freezes on its own → the site's loop is real and extension-independent.
2. **Extension + neutralized region**: `evaluateOnNewDocument` that pre-marks the suspect region with your exclusion mechanism before the extension walks it. Clean numbers here = that region is the trigger; ship it as a site rule / default exclusion.

Beware: a hand-made trigger that DOESN'T freeze does not exonerate the site — the real interaction may need the extension's exact churn pattern (insert/remove cycles, observer feedback timing). Experiment (2) is the decisive one; (1) is corroboration.

## Reading the result

The combination this skill was born from: storm fixes in the extension were correct (unit-proven) yet the page still burned 840s CPU — the trace showed 90% self-time in the site's own jQuery width-measurement chain, spinning in a `while (menuIsOverflowing())` overflow handler retriggered by a ResizeObserver after translations widened the menu. One exclusion rule fixed what no amount of extension-side code could.
