import { describe, expect, it } from 'vitest'
import { Sha256Hex } from '../hash'

describe('test Sha256Hex', () => {
  it('should generate SHA256 hash for single text', () => {
    const result = Sha256Hex('hello')
    expect(result).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
    expect(result.length).toBe(64)
  })

  it('should generate SHA256 hash for multiple texts with separator', () => {
    const result = Sha256Hex('hello', 'world')
    expect(result).toBe('55a3db6314a88ae7f97bdbc9133e215f32ee5c93a84d600a5a003ccd9d82c305')
  })

  it('should handle different parameter combinations correctly', () => {
    const result1 = Sha256Hex('a', 'bc')
    const result2 = Sha256Hex('ab', 'c')
    expect(result1).not.toBe(result2)
  })

  it('should throw error when no parameters provided', () => {
    expect(() => Sha256Hex()).toThrow('At least one text parameter is required')
  })
})
