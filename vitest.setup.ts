import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock @wxt-dev/i18n module to avoid browser.i18n.getMessage not implemented error
vi.mock('#i18n', () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

// Mock the fakeBrowser's i18n.getMessage method which is not implemented in fake-browser
// This is used when WxtVitest plugin replaces browser imports with fake-browser
vi.mock('wxt/testing', async () => {
  const actual = await vi.importActual<any>('wxt/testing')
  return {
    ...actual,
    fakeBrowser: {
      ...actual.fakeBrowser,
      i18n: {
        ...actual.fakeBrowser.i18n,
        getMessage: (key: string) => key.replaceAll('_', '.'),
      },
      identity: {
        ...actual.fakeBrowser.identity,
        getRedirectURL: () => 'https://mock-redirect-url.chromiumapp.org/',
      },
      runtime: {
        ...actual.fakeBrowser.runtime,
        getManifest: () => ({
          manifest_version: 3,
          name: 'Read Frog',
          version: '1.0.0',
          description: 'Test manifest',
        }),
      },
    },
  }
})

// JSDom + Vitest don't play well with each other. Long story short - default
// TextEncoder produces Uint8Array objects that are _different_ from the global
// Uint8Array objects, so some functions that compare their types explode.
// https://github.com/vitest-dev/vitest/issues/4043#issuecomment-1905172846
class ESBuildAndJSDOMCompatibleTextEncoder extends TextEncoder {
  constructor() {
    super()
  }

  encode(input: string) {
    if (typeof input !== 'string') {
      throw new TypeError('`input` must be a string')
    }

    const decodedURI = decodeURIComponent(encodeURIComponent(input))
    const arr = new Uint8Array(decodedURI.length)
    const chars = decodedURI.split('')
    for (let i = 0; i < chars.length; i++) {
      arr[i] = decodedURI[i].charCodeAt(0)
    }
    return arr
  }
}

globalThis.TextEncoder = ESBuildAndJSDOMCompatibleTextEncoder
