import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSignatureDate, generateTranslatorSignature } from '../signature'

describe('edge tts signature', () => {
  const testSignatureSecret
    = 'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA='

  beforeEach(() => {
    vi.stubEnv('WXT_EDGE_TTS_SIGNATURE_SECRET_BASE64', testSignatureSecret)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('formats date like translator signature format', () => {
    const date = new Date('2026-02-22T05:21:00.000Z')
    const formatted = buildSignatureDate(date)

    expect(formatted).toMatch(/ GMT$/)
    expect(formatted).toContain('sun, 22 feb 2026')
  })

  it('generates signature payload with four segments', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('12345678-1234-1234-1234-123456789abc')
    const signature = await generateTranslatorSignature(
      'https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0',
      new Date('2026-02-22T05:21:00.000Z'),
    )

    const parts = signature.split('::')
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe('MSTranslatorAndroidApp')
    expect(parts[1]).toMatch(/^[A-Z0-9+/=]+$/i)
    expect(parts[3]).toBe('12345678123412341234123456789abc')
  })

  it('uses default secret when runtime env is missing', async () => {
    vi.unstubAllEnvs()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('abcdefab-cdef-cdef-cdef-abcdefabcdef')

    const signature = await generateTranslatorSignature(
      'https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0',
      new Date('2026-02-22T05:21:00.000Z'),
    )

    const parts = signature.split('::')
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe('MSTranslatorAndroidApp')
    expect(parts[1]).toMatch(/^[A-Z0-9+/=]+$/i)
    expect(parts[3]).toBe('abcdefabcdefcdefcdefabcdefabcdef')
  })
})
