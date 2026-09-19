import { vi } from "vitest"
import "@testing-library/jest-dom"

// Keep test output quiet by default. Individual tests can still spy on these
// methods when they need to assert logging behavior.
// eslint-disable-next-line no-console
console.log = () => {}
// eslint-disable-next-line no-console
console.info = () => {}
console.warn = () => {}
console.error = () => {}

class MemoryStorage implements Storage {
  #store = new Map<string, string>()

  get length() {
    return this.#store.size
  }

  clear() {
    this.#store.clear()
  }

  getItem(key: string) {
    return this.#store.get(key) ?? null
  }

  key(index: number) {
    return [...this.#store.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.#store.delete(key)
  }

  setItem(key: string, value: string) {
    this.#store.set(key, value)
  }
}

// Node 22 exposes built-in Web Storage. In worker processes without a configured
// backing file, reading it emits `--localstorage-file` warnings. Replace it with
// an in-memory test double before app modules import Jotai utils.
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: new MemoryStorage(),
})

Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: new MemoryStorage(),
})

// Mock the runtime i18n facade so tests resolve keys deterministically (returning the
// dot-key, matching the pre-migration behaviour that test assertions rely on) without
// initializing i18next or touching browser.i18n.
vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string) => key,
  },
  initI18n: async () => {},
  setUiLanguage: async () => {},
}))

// LocaleBoundary is a separate module from the mocked facade above and pulls in i18next +
// the bundled YAML resources (which vitest has no plugin for). Stub it to a passthrough so
// no test loads i18next or the .yml files; runtime language switching is not under test here.
vi.mock("@/utils/i18n/locale-boundary", () => ({
  LocaleBoundary: ({ children }: { children: unknown }) => children,
}))

// Iconify's <Icon> fetches icon data from api.iconify.design on mount and schedules
// retry timers when that fetch stalls (common in CI). Those Node timers outlive the
// test file's jsdom environment and crash React with "window is not defined" as an
// unhandled error attributed to whichever file runs next. Render an inert placeholder
// instead; no test exercises real icon loading. iconify-internal-api.test.ts opts back
// in via vi.unmock to keep its _api canary pointed at the real package.
vi.mock("@iconify/react", async () => {
  const { createElement } = await import("react")
  return {
    Icon: ({ className, icon }: { className?: string; icon: string }) =>
      createElement("span", { "aria-hidden": true, className, "data-icon": icon }),
    _api: {
      setFetch: () => {},
    },
  }
})

// Mock the fakeBrowser's i18n.getMessage method which is not implemented in fake-browser
// This is used when WxtVitest plugin replaces browser imports with fake-browser
vi.mock("wxt/testing/fake-browser", async () => {
  const actual = await vi.importActual<any>("wxt/testing/fake-browser")

  Object.assign(actual.fakeBrowser.i18n, {
    getMessage: (key: string) => key.replaceAll("_", "."),
  })
  Object.assign(actual.fakeBrowser.identity, {
    getRedirectURL: () => "https://mock-redirect-url.chromiumapp.org/",
  })
  Object.assign(actual.fakeBrowser.runtime, {
    getManifest: () => ({
      manifest_version: 3,
      name: "Read Frog",
      version: "1.0.0",
      description: "Test manifest",
    }),
  })

  return actual
})

// jsdom implements no layout, so it omits Range.getBoundingClientRect entirely
// (Element.getBoundingClientRect it does stub, returning zeros). Every browser
// ships it. Match jsdom's own convention with a zero rect so layout probes
// short-circuit instead of throwing; tests that exercise them spy on this.
// (Guarded: this setup file also runs for node-environment test files.)
if (typeof Range !== "undefined" && typeof Range.prototype.getBoundingClientRect !== "function") {
  Range.prototype.getBoundingClientRect = function () {
    return {
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }
  }
}

// JSDom + Vitest don't play well with each other. Long story short - default
// TextEncoder produces Uint8Array objects that are _different_ from the global
// Uint8Array objects, so some functions that compare their types explode.
// https://github.com/vitest-dev/vitest/issues/4043#issuecomment-1905172846
class ESBuildAndJSDOMCompatibleTextEncoder extends TextEncoder {
  override encode(input: string) {
    if (typeof input !== "string") {
      throw new TypeError("`input` must be a string")
    }

    const decodedURI = decodeURIComponent(encodeURIComponent(input))
    const arr = new Uint8Array(decodedURI.length)
    const chars = decodedURI.split("")
    for (let i = 0; i < chars.length; i++) {
      arr[i] = decodedURI[i]!.charCodeAt(0)
    }
    return arr
  }
}

globalThis.TextEncoder = ESBuildAndJSDOMCompatibleTextEncoder

// jsdom 30.1 ships @asamuzakjp/dom-selector 9, which rejects any selector longer
// than 2048 characters (`Selector exceeds maximum allowed length of 2048`); the 8.x
// it replaced had no such cap. No browser does either — verified in Chrome 153,
// where matches(), closest() and querySelector() all accept a 4000-character list —
// so this is a jsdom limitation, not a product constraint, and it belongs here
// rather than in the hot-path selector code.
//
// It bites because site rules union their selector lists: the effective
// includeSelector for a github URL is ~2.5k characters across 71 entries, and
// `isSiteRuleExcludedElement` feeds it straight to matches()/closest().
// Splitting the list on its top-level commas and testing chunk by chunk is exactly
// equivalent for a selector list. Only matches()/closest() are patched: they are
// the only ones a selector this long reaches (every other resolved selector field
// is well under the cap).
const JSDOM_SELECTOR_LENGTH_LIMIT = 2048

/** Split a selector list on its top-level commas, ignoring commas nested in
 * `:is(...)`, `[attr="a,b"]` and the like. */
function splitSelectorList(selector: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote: string | null = null
  let start = 0

  for (let i = 0; i < selector.length; i++) {
    const char = selector[i]!
    if (quote !== null) {
      if (char === "\\") {
        i++
      } else if (char === quote) {
        quote = null
      }
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
    } else if (char === "(" || char === "[") {
      depth++
    } else if (char === ")" || char === "]") {
      depth--
    } else if (char === "," && depth === 0) {
      parts.push(selector.slice(start, i))
      start = i + 1
    }
  }
  parts.push(selector.slice(start))

  return parts.map((part) => part.trim()).filter(Boolean)
}

/** Regroup a selector list into the fewest chunks that each stay under the cap. */
function chunkSelector(selector: string): string[] {
  const chunks: string[] = []
  let current = ""

  for (const part of splitSelectorList(selector)) {
    const next = current === "" ? part : `${current},${part}`
    if (next.length > JSDOM_SELECTOR_LENGTH_LIMIT && current !== "") {
      chunks.push(current)
      current = part
    } else {
      current = next
    }
  }
  if (current !== "") {
    chunks.push(current)
  }

  return chunks
}

if (typeof Element !== "undefined") {
  const prototype = Element.prototype
  // Read through the descriptors: a direct `prototype.matches` reference would be
  // re-resolved after the patch below lands and recurse forever.
  const nativeMatches = Object.getOwnPropertyDescriptor(prototype, "matches")?.value as (
    this: Element,
    selector: string,
  ) => boolean
  const nativeClosest = Object.getOwnPropertyDescriptor(prototype, "closest")?.value as (
    this: Element,
    selector: string,
  ) => Element | null

  // defineProperty rather than assignment: both methods are declared as overload
  // sets whose tag-name overloads are type predicates, which a plain
  // `(selector: string) => …` replacement is not assignable to.
  Object.defineProperty(prototype, "matches", {
    configurable: true,
    writable: true,
    value: function (this: Element, selector: string) {
      if (selector.length <= JSDOM_SELECTOR_LENGTH_LIMIT) {
        return nativeMatches.call(this, selector)
      }
      return chunkSelector(selector).some((chunk) => nativeMatches.call(this, chunk))
    },
  })

  Object.defineProperty(prototype, "closest", {
    configurable: true,
    writable: true,
    value: function (this: Element, selector: string) {
      if (selector.length <= JSDOM_SELECTOR_LENGTH_LIMIT) {
        return nativeClosest.call(this, selector)
      }
      // Every chunk's hit lies on this element's ancestor chain, so the hits are
      // totally ordered by containment; the real answer is the deepest one.
      let deepest: Element | null = null
      for (const chunk of chunkSelector(selector)) {
        const hit = nativeClosest.call(this, chunk)
        if (hit !== null && (deepest === null || deepest.contains(hit))) {
          deepest = hit
        }
      }
      return deepest
    },
  })
}
