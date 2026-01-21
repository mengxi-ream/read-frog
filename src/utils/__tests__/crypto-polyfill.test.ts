import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateUUIDv4 } from '@/utils/crypto-polyfill'

describe('generateUUIDv4', () => {
  let getRandomValuesSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getRandomValuesSpy = vi.spyOn(crypto, 'getRandomValues')
  })

  afterEach(() => {
    getRandomValuesSpy.mockRestore()
  })

  it('should generate valid UUID v4 format', () => {
    const uuid = generateUUIDv4()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(uuid).toMatch(uuidRegex)
  })

  it('should generate unique UUIDs', () => {
    const uuids = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      uuids.add(generateUUIDv4())
    }
    expect(uuids.size).toBe(1000)
  })

  it('should set version 4 and variant 1 bits correctly', () => {
    const uuid = generateUUIDv4()
    const parts = uuid.split('-')

    // Version 4: bits 12-13 of time_hi_and_version should be 0100
    expect(parts[2]?.startsWith('4')).toBe(true)

    // Variant 1: bits 6-7 of clock_seq_hi_and_reserved should be 10xx
    const variantChar = parts[3]?.[0]
    expect(['8', '9', 'a', 'b', 'A', 'B']).toContain(variantChar)
  })

  it('should use crypto.getRandomValues to generate random bytes', () => {
    generateUUIDv4()
    expect(getRandomValuesSpy).toHaveBeenCalledTimes(1)
    expect(getRandomValuesSpy).toHaveBeenCalledWith(expect.any(Uint8Array))
  })

  it('should generate correct UUID for known input', () => {
    // Mock specific bytes to verify the algorithm
    getRandomValuesSpy.mockImplementation((array: Uint8Array) => {
      const mockBytes = [0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF]
      array.set(mockBytes)
      return array
    })

    const uuid = generateUUIDv4()

    // After version/variant bit manipulation:
    // bytes[6] = 0x66 & 0x0F | 0x40 = 0x46
    // bytes[8] = 0x88 & 0x3F | 0x80 = 0x88
    // Note: bytes[7] remains 0x77
    expect(uuid).toBe('00112233-4455-4677-8899-aabbccddeeff')
  })
})
