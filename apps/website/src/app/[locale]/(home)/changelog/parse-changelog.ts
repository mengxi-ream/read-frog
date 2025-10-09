import type { SemanticVersion, VersionType } from '@repo/definitions'
import { getVersionType, semanticVersionSchema } from '@repo/definitions'

export interface ChangelogEntry {
  version: SemanticVersion
  versionType: VersionType
  majorChanges: string[]
  minorChanges: string[]
  patchChanges: string[]
}

export function parseChangelog(content: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []
  const lines = content.split('\n')

  let currentEntry: ChangelogEntry | null = null
  let currentSection: 'major' | 'minor' | 'patch' | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line)
      continue

    // Check for version header (e.g., "## 1.12.1")
    const versionMatch = line.match(/^##\s+(\d+\.\d+\.\d+)/)
    if (versionMatch) {
      // Save previous entry if exists
      if (currentEntry) {
        entries.push(currentEntry)
      }

      // Start new entry
      const version = versionMatch[1]
      if (version) {
        try {
          // Validate version using the semantic version schema
          const validatedVersion = semanticVersionSchema.parse(version)
          const versionType = getVersionType(validatedVersion)

          currentEntry = {
            version: validatedVersion,
            versionType,
            majorChanges: [],
            minorChanges: [],
            patchChanges: [],
          }
        }
        catch {
          // Skip this entry if version is invalid
          currentEntry = null
        }
      }
      currentSection = null
      continue
    }

    // Check for section headers
    if (line.match(/^###\s+Major Changes/)) {
      currentSection = 'major'
      continue
    }
    if (line.match(/^###\s+Minor Changes/)) {
      currentSection = 'minor'
      continue
    }
    if (line.match(/^###\s+Patch Changes/)) {
      currentSection = 'patch'
      continue
    }

    // Check for list items (changes)
    const changeMatch = line.match(/^-\s+(.+)/)
    if (changeMatch && changeMatch[1] && currentEntry && currentSection) {
      const change = changeMatch[1].trim()
      if (change) {
        switch (currentSection) {
          case 'major':
            currentEntry.majorChanges.push(change)
            break
          case 'minor':
            currentEntry.minorChanges.push(change)
            break
          case 'patch':
            currentEntry.patchChanges.push(change)
            break
        }
      }
    }
  }

  // Don't forget to add the last entry
  if (currentEntry) {
    entries.push(currentEntry)
  }

  return entries
}
