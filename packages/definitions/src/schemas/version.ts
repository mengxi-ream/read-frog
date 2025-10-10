import { z } from 'zod'

/**
 * Semantic version regex pattern
 * Matches versions like: 1.0.0, 10.20.30
 * Does NOT match: v1.0.0, 1.0.0-alpha, 1.0, 1.-1.0
 */
export const SEMANTIC_VERSION_REGEX = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

/**
 * Zod schema for semantic version validation
 * Validates semantic version strings according to SemVer conventions
 * Requires exactly 3 parts: major.minor.patch
 *
 * @example
 * semanticVersionSchema.parse('1.0.0') // ✓ valid
 * semanticVersionSchema.parse('10.20.30') // ✓ valid
 * semanticVersionSchema.parse('1.11') // ✗ throws error (must have 3 parts)
 * semanticVersionSchema.parse('v1.0.0') // ✗ throws error
 * semanticVersionSchema.parse('1.0.0-alpha') // ✗ throws error
 */
export const semanticVersionSchema = z.string().regex(
  SEMANTIC_VERSION_REGEX,
  'Must be a valid semantic version with exactly 3 parts (e.g., 1.0.0, 10.20.30)',
).refine(
  (version) => {
    // Additional validation: ensure all parts are non-negative numbers
    const parts = version.split('.')
    return parts.length === 3 && parts.every(part => !Number.isNaN(Number(part)) && Number(part) >= 0)
  },
  { message: 'Version must have exactly 3 parts and all parts must be non-negative numbers' },
)

/**
 * Type for semantic version string
 */
export type SemanticVersion = z.infer<typeof semanticVersionSchema>

/**
 * Version type classification
 */
export type VersionType = 'major' | 'minor' | 'patch'

/**
 * Parse a semantic version string into its components
 * Validates the input using semanticVersionSchema before parsing
 *
 * @param version - The version string to parse (must be in format major.minor.patch)
 * @returns An object containing the major, minor, and patch numbers
 * @throws {z.ZodError} If the version string is invalid
 *
 * @example
 * parseSemanticVersion('1.2.3') // { major: 1, minor: 2, patch: 3 }
 * parseSemanticVersion('10.20.30') // { major: 10, minor: 20, patch: 30 }
 * parseSemanticVersion('1.0') // throws error - must have 3 parts
 * parseSemanticVersion('v1.0.0') // throws error - invalid format
 */
export function parseSemanticVersion(version: string): {
  major: number
  minor: number
  patch: number
} {
  // Validate the version string first
  const validatedVersion = semanticVersionSchema.parse(version)

  const parts = validatedVersion.split('.')
  return {
    major: Number.parseInt(parts[0]!, 10),
    minor: Number.parseInt(parts[1]!, 10),
    patch: Number.parseInt(parts[2]!, 10),
  }
}

/**
 * Determine the version type (major, minor, or patch) based on semantic versioning rules
 * Validates the input using semanticVersionSchema before classification
 *
 * @param version - The version string to classify
 * @returns The version type classification
 * @throws {z.ZodError} If the version string is invalid
 *
 * @example
 * getVersionType('1.0.0') // 'major'
 * getVersionType('1.2.0') // 'minor'
 * getVersionType('1.2.3') // 'patch'
 * getVersionType('1.0') // throws error - must have 3 parts
 */
export function getVersionType(version: string): VersionType {
  // parseSemanticVersion already validates the version
  const { major, minor, patch } = parseSemanticVersion(version)

  if (major > 0 && minor === 0 && patch === 0) {
    return 'major'
  }
  else if (minor > 0 && patch === 0) {
    return 'minor'
  }
  else {
    return 'patch'
  }
}
