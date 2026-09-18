/* Recorder template for record-extension-demo.
 * Proven end to end 2026-09-17 against the built extension (2 scenes,
 * 1280x800 frames, MP4 + GIF assembled and visually QA'd).
 *
 * Setup: npm i puppeteer   (in the session scratchpad; Chrome comes from ~/.cache/puppeteer)
 * Run:   node record.js    (headed on purpose — extensions do not load headless)
 * Then:  python3 <skill>/scripts/build_demo.py demo-work/manifest.json
 *
 * Adapt EXT_PATH, the fixture, the captions, and the scene actions. The
 * extension-control plumbing and the screencast bookkeeping are the parts that
 * are easy to get wrong — keep them.
 */
const http = require('node:http')
const path = require('node:path')
const fs = require('node:fs')
const puppeteer = require('puppeteer')

const EXT_PATH = '/ABS/PATH/TO/read-frog/.output/chrome-mv3' // test -f manifest.json first!
const PAGE_DIR = path.join(__dirname, 'page')
const OUT = path.join(__dirname, 'demo-work', 'candidate')
const PORT = 8931
const VIEWPORT = { width: 1280, height: 800, deviceScaleFactor: 1 }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function serve() {
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const file = path.join(PAGE_DIR, req.url === '/' ? 'index.html' : req.url)
      try {
        const body = fs.readFileSync(file)
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'text/plain' })
        res.end(body)
      } catch {
        res.writeHead(404); res.end()
      }
    })
    server.listen(PORT, () => resolve(server))
  })
}

async function getWorker(browser) {
  for (let i = 0; i < 60; i++) {
    const t = browser.targets().find((t) => t.type() === 'service_worker' && t.url().includes('background'))
    if (t) return t.worker()
    await sleep(500)
  }
  throw new Error('service worker not found')
}

async function patchConfig(browser) {
  const worker = await getWorker(browser)
  const patch = () => worker.evaluate(async () => {
    const { config } = await chrome.storage.local.get('config')
    if (!config) return 'no-config-yet'
    config.language.targetCode = 'cmn'
    config.language.sourceCode = 'auto'
    // Top-level key is `pageTranslation`, NOT `translate`: the schema is
    // non-strict, so a stale key is stripped and the patch silently does nothing.
    config.pageTranslation.mode = 'bilingual'
    config.pageTranslation.providerId = 'microsoft-translate-default'
    config.floatingButton.enabled = false
    await chrome.storage.local.set({ config })
    return `ok mode=${config.pageTranslation.mode} provider=${config.pageTranslation.providerId} target=${config.language.targetCode}`
  })
  let r = await patch()
  for (let i = 0; i < 20 && r === 'no-config-yet'; i++) { await sleep(500); r = await patch() }
  await sleep(4000)
  r = await patch()
  console.log('[config]', r)
}

async function toggle(browser, enabled) {
  const worker = await getWorker(browser)
  return worker.evaluate(async (on, port) => {
    const tabs = await chrome.tabs.query({ url: `http://localhost:${port}/*` })
    if (!tabs.length) return 'no-tab'
    await chrome.tabs.sendMessage(tabs[0].id, {
      id: Math.floor(Math.random() * 1e9),
      type: 'askManagerToTogglePageTranslation',
      data: { enabled: on },
      timestamp: Date.now(),
    })
    return `sent enabled=${on}`
  }, enabled, PORT)
}

async function showCaption(page, text) {
  await page.evaluate((t) => {
    document.querySelectorAll('[data-demo-overlay]').forEach((n) => n.remove())
    const pill = document.createElement('div')
    pill.setAttribute('data-demo-overlay', 'caption')
    pill.className = 'notranslate'
    pill.setAttribute('translate', 'no')
    pill.textContent = t
    Object.assign(pill.style, {
      position: 'fixed', top: '20px', left: '20px', zIndex: '2147483647',
      background: 'rgba(11,13,18,0.92)', color: '#fff', padding: '10px 16px',
      borderRadius: '999px', font: '500 15px/1.2 -apple-system, system-ui, sans-serif',
      pointerEvents: 'none', boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
    })
    document.body.appendChild(pill)
  }, text)
}
async function clearOverlays(page) {
  await page.evaluate(() => document.querySelectorAll('[data-demo-overlay]').forEach((n) => n.remove()))
}

async function recordScene(page, name, action) {
  const dir = path.join(OUT, name)
  fs.mkdirSync(dir, { recursive: true })
  const cdp = await page.createCDPSession()
  const frames = []
  let seq = 0
  const onFrame = async ({ data, metadata, sessionId }) => {
    const file = `frame-${String(seq).padStart(5, '0')}.jpg`
    fs.writeFileSync(path.join(dir, file), Buffer.from(data, 'base64'))
    frames.push({ file, timestamp: metadata.timestamp, sequence: ++seq })
    try { await cdp.send('Page.screencastFrameAck', { sessionId }) } catch {}
  }
  await cdp.send('Page.enable')
  cdp.on('Page.screencastFrame', onFrame)
  try {
    await cdp.send('Page.startScreencast', {
      format: 'jpeg', quality: 90,
      maxWidth: VIEWPORT.width, maxHeight: VIEWPORT.height, everyNthFrame: 1,
    })
    // A screencast only emits on repaint: a static page produces NO frames.
    // Each 1px scroll nudge buys roughly one frame.
    await page.evaluate(() => { window.scrollBy(0, 1); window.scrollBy(0, -1) })
    await sleep(400)
    const assertion = await action()
    // presentation hold: idle frames while the end state is on screen
    for (let i = 0; i < 6; i++) { await page.evaluate(() => { window.scrollBy(0, 1); window.scrollBy(0, -1) }); await sleep(400) }
    fs.writeFileSync(path.join(dir, 'assertion.json'), JSON.stringify(assertion, null, 2))
    console.log(`[scene ${name}]`, JSON.stringify(assertion))
  } finally {
    await cdp.send('Page.stopScreencast').catch(() => {})
    cdp.off('Page.screencastFrame', onFrame)
    await sleep(300)
    fs.writeFileSync(path.join(dir, 'frames.json'), JSON.stringify({ name, frames }, null, 2))
    await cdp.detach().catch(() => {})
  }
  const sizes = frames.map((f) => fs.statSync(path.join(dir, f.file)).size)
  console.log(`[scene ${name}] frames=${frames.length} medianBytes=${sizes.sort((a,b)=>a-b)[Math.floor(sizes.length/2)]}`)
  return frames.length
}

const countState = (page) => page.evaluate(() => ({
  wrappers: document.querySelectorAll('.read-frog-translated-content-wrapper').length,
  anchors: document.querySelectorAll('[data-read-frog-translation-only]').length,
  cjk: /[一-鿿]/.test(document.body.textContent ?? ''),
}))

async function waitFor(fn, label, timeoutMs = 30000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await fn()) return true
    await sleep(400)
  }
  throw new Error(`timeout waiting for ${label}`)
}

async function main() {
  fs.rmSync(path.join(__dirname, 'demo-work'), { recursive: true, force: true })
  const server = await serve()
  const browser = await puppeteer.launch({
    headless: false, pipe: true, enableExtensions: true,
    args: ['--no-first-run', '--window-size=1320,900'],
  })
  try {
    await browser.installExtension(EXT_PATH)
    await patchConfig(browser)

    // onInstalled(reason: 'install') opens ${WXT_WEBSITE_URL}/guide/step-1 —
    // it will be the foreground tab if you do not close it before recording
    await sleep(2000)
    for (const p of await browser.pages()) {
      const url = p.url()
      if (url.includes('/guide/') || url === 'about:blank') await p.close().catch(() => {})
    }

    const page = await browser.newPage()
    await page.setViewport(VIEWPORT)
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' })
    await page.waitForSelector('main h1')

    // warm the provider + content script, then restore
    await toggle(browser, true)
    await waitFor(async () => (await countState(page)).wrappers > 0, 'warm translation')
    await toggle(browser, false)
    await waitFor(async () => (await countState(page)).wrappers === 0, 'warm restore')
    await sleep(800)

    await showCaption(page, 'Toggle translation — bilingual mode')
    await recordScene(page, '01-translate', async () => {
      await toggle(browser, true)
      await waitFor(async () => {
        const s = await countState(page)
        return s.wrappers >= 5 && s.cjk
      }, 'translated nodes')
      return { scene: '01-translate', expect: 'wrappers >= 5 and CJK present', got: await countState(page) }
    })

    await showCaption(page, 'Show original — the page is restored')
    await recordScene(page, '02-restore', async () => {
      await toggle(browser, false)
      await waitFor(async () => {
        const s = await countState(page)
        return s.wrappers === 0 && s.anchors === 0
      }, 'restored page')
      return { scene: '02-restore', expect: 'wrappers == 0 and anchors == 0', got: await countState(page) }
    })

    await clearOverlays(page)
    console.log('[done]')
  } finally {
    await browser.close().catch(() => {})
    server.close()
  }
}

main().catch((e) => { console.error(e); process.exit(2) })
