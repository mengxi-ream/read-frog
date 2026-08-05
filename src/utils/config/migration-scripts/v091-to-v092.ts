/**
 * Migration script from v091 to v092.
 *
 * Page and subtitle translation now persist the code-owned `default` prompt as
 * a real id instead of encoding it as `null`. Page translation also gains the
 * `precision-rewrite` built-in. Existing custom prompts may already use either
 * newly reserved id, so those custom ids are moved out of the reserved namespace
 * before the selected id is updated.
 *
 * IMPORTANT: All ids and helpers are frozen inline. Migration scripts must not
 * import constants or utilities from the evolving application code.
 */

function nextCustomId(originalId: string, usedIds: Set<string>): string {
  const baseId = `${originalId}-custom`
  let candidate = baseId
  let suffix = 2

  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`
    suffix += 1
  }

  usedIds.add(candidate)
  return candidate
}

function migratePromptConfig(promptConfig: any, reservedIds: readonly string[]): any {
  if (
    !promptConfig ||
    typeof promptConfig !== "object" ||
    Array.isArray(promptConfig) ||
    !Array.isArray(promptConfig.patterns)
  ) {
    return promptConfig
  }

  const reservedIdSet = new Set(reservedIds)
  const usedIds = new Set(reservedIds)

  for (const pattern of promptConfig.patterns) {
    if (
      pattern &&
      typeof pattern === "object" &&
      !Array.isArray(pattern) &&
      typeof pattern.id === "string" &&
      !reservedIdSet.has(pattern.id)
    ) {
      usedIds.add(pattern.id)
    }
  }

  let selectedCustomId: string | undefined
  let changedPattern = false
  const patterns = promptConfig.patterns.map((pattern: any) => {
    if (
      !pattern ||
      typeof pattern !== "object" ||
      Array.isArray(pattern) ||
      typeof pattern.id !== "string" ||
      !reservedIdSet.has(pattern.id)
    ) {
      return pattern
    }

    const renamedId = nextCustomId(pattern.id, usedIds)
    changedPattern = true

    // In v091 a selected reserved-looking id could only have referred to the
    // custom prompt. With duplicate invalid ids, preserve the first match.
    if (selectedCustomId === undefined && promptConfig.promptId === pattern.id) {
      selectedCustomId = renamedId
    }

    return {
      ...pattern,
      id: renamedId,
    }
  })

  const promptId =
    selectedCustomId ?? (promptConfig.promptId === null ? "default" : promptConfig.promptId)

  if (!changedPattern && promptId === promptConfig.promptId) {
    return promptConfig
  }

  return {
    ...promptConfig,
    promptId,
    patterns,
  }
}

function migrateSurface(surface: any, reservedIds: readonly string[]): any {
  if (!surface || typeof surface !== "object" || Array.isArray(surface)) {
    return surface
  }

  const customPromptsConfig = migratePromptConfig(surface.customPromptsConfig, reservedIds)
  if (customPromptsConfig === surface.customPromptsConfig) {
    return surface
  }

  return {
    ...surface,
    customPromptsConfig,
  }
}

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object" || Array.isArray(oldConfig)) {
    return oldConfig
  }

  const translate = migrateSurface(oldConfig.translate, ["default", "precision-rewrite"])
  const videoSubtitles = migrateSurface(oldConfig.videoSubtitles, ["default"])

  let migratedConfig = oldConfig

  if (translate !== oldConfig.translate) {
    migratedConfig = {
      ...migratedConfig,
      translate,
    }
  }

  if (videoSubtitles !== oldConfig.videoSubtitles) {
    migratedConfig = {
      ...migratedConfig,
      videoSubtitles,
    }
  }

  return migratedConfig
}
