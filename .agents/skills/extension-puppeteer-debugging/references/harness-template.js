/* Puppeteer harness template for driving the built read-frog extension.
 * Proven working 2026-07-13 (issue #1846 E2E), re-proven 2026-07-31 (issue
 * #2011 repro). Adapt EXT_PATH, PORT, fixture dir, and the assertions; the
 * extension-control plumbing below is the part that is easy to get wrong —
 * keep it.
 *
 * Setup: npm i puppeteer   (Chrome comes from ~/.cache/puppeteer)
 * Run:   node harness.js   (headed on purpose — watch it while it runs)
 */
const http = require('node:http')
const path = require('node:path')
const fs = require('node:fs')
const puppeteer = require('puppeteer')

const EXT_PATH = '/ABS/PATH/TO/read-frog/.output/chrome-mv3' // test -f manifest.json first!
const PAGE_DIR = path.join(__dirname, 'page') // your fixture; served over http, NEVER file://
const PORT = 8931

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function serve() {
  const MIME = { '.html': 'text/html', '.js': 'text/javascript' }
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const file = path.join(PAGE_DIR, req.url === '/' ? 'index.html' : req.url)
      try {
        // Read BEFORE writeHead: if the read throws after writeHead(200)
        // (e.g. /favicon.ico), the catch's writeHead(404) double-writes
        // headers -> ERR_HTTP_HEADERS_SENT crashes the whole harness.
        const body = fs.readFileSync(file)
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'text/plain' })
        res.end(body)
      } catch {
        res.writeHead(404)
        res.end()
      }
    })
    server.listen(PORT, () => resolve(server))
  })
}

async function getServiceWorker(browser) {
  for (let i = 0; i < 60; i++) {
    const sw = browser
      .targets()
      .find((t) => t.type() === 'service_worker' && t.url().includes('background'))
    if (sw) return sw.worker()
    await sleep(500)
  }
  throw new Error('extension service worker not found — did installExtension succeed?')
}

/* Patch the extension config. TRAPS this encodes:
 * - the MV3 service worker CSP (script-src 'self' 'wasm-unsafe-eval' ...)
 *   blocks eval, so `new Function(mutateSrc)` inside worker.evaluate throws
 *   EvalError -> inline your mutations in the evaluated function below;
 *   pass only plain data as evaluate args, never code strings
 * - background init/migration clobbers early writes -> patch, wait, re-patch
 * - onboarding overwrites targetCode with the browser UI language -> force cmn
 *   or the same-language skip silently translates nothing on English fixtures */
async function patchConfig(browser) {
  const worker = await getServiceWorker(browser)
  const patch = () =>
    worker.evaluate(async () => {
      const { config } = await chrome.storage.local.get('config')
      if (!config) return 'no-config-yet'
      config.language.targetCode = 'cmn'
      config.language.sourceCode = 'auto'
      config.translate.mode = 'translationOnly' // <-- inline YOUR mutations here
      await chrome.storage.local.set({ config })
      return `ok mode=${config.translate.mode} target=${config.language.targetCode}`
    })
  let result = await patch()
  for (let i = 0; i < 20 && result === 'no-config-yet'; i++) {
    await sleep(500)
    result = await patch()
  }
  await sleep(4000) // let init/migration finish, then make the write stick
  result = await patch()
  console.log('[config]', result)
}

/* Toggle page translation exactly like the popup does. TRAP: do NOT synthesize
 * Alt+E — on macOS Option+E is a dead key and the hotkey never fires. */
async function setTranslation(browser, enabled) {
  const worker = await getServiceWorker(browser)
  return worker.evaluate(
    async (on, port) => {
      const tabs = await chrome.tabs.query({ url: `http://localhost:${port}/*` })
      if (!tabs.length) return 'no-tab'
      await chrome.tabs.sendMessage(tabs[0].id, {
        id: Math.floor(Math.random() * 1e9), // webext-core envelope
        type: 'askManagerToTogglePageTranslation',
        data: { enabled: on },
        timestamp: Date.now(),
      })
      return `sent enabled=${on}`
    },
    enabled,
    PORT,
  )
}

async function main() {
  const server = await serve()
  const browser = await puppeteer.launch({
    headless: false,
    pipe: true, // required for installExtension
    enableExtensions: true, // Chrome 137+ ignores --load-extension; this is the way
    args: ['--no-first-run', '--window-size=1200,900'],
  })

  try {
    await browser.installExtension(EXT_PATH)
    await patchConfig(browser)

    const page = await browser.newPage()
    const errors = []
    page.on('console', (m) => /Minified React error|NotFoundError/.test(m.text()) && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' })
    await sleep(1500)

    console.log('[toggle]', await setTranslation(browser, true))
    // Poll for CJK instead of a fixed sleep — provider latency varies
    for (let i = 0; i < 40; i++) {
      await sleep(500)
      const text = await page.evaluate(() => document.body.textContent ?? '')
      if (/[一-鿿]/.test(text)) break
    }

    // Extension DOM state: wrappers = fallback strategy, anchors = in-place swap
    console.log(
      await page.evaluate(() => ({
        wrappers: document.querySelectorAll('.read-frog-translated-content-wrapper').length,
        anchors: document.querySelectorAll('[data-read-frog-translation-only]').length,
      })),
    )

    console.log('[toggle]', await setTranslation(browser, false))
    await sleep(2500)

    // Restore assertions: compare innerHTML MODULO walk labels — the walker's
    // data-read-frog-* marks persist after restore by design in every mode.
    // const clean = (html) => html.replace(/\s*data-read-frog-[a-z-]+="[^"]*"/g, '')

    console.log('[page errors]', errors)
  } finally {
    await browser.close().catch(() => {})
    server.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
