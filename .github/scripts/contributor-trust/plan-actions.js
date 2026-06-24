import { bucketToLabel, MANAGED_TRUST_LABELS, POLICY } from "./config.js"

const CONFIG_MIGRATION_CHANGED_LINE_PATH_PATTERNS = Object.freeze([
  /^src\/utils\/config\/migration-scripts\/v\d+-to-v\d+\.ts$/,
  /^src\/utils\/config\/__tests__\/migration-scripts\/v\d+-to-v\d+\.test\.ts$/,
  /^src\/utils\/config\/__tests__\/example\/v\d+\.ts$/,
])

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function toChangedLineCount(value) {
  return Number(value) || 0
}

function getPullRequestFilePath(file) {
  return String(file?.filename ?? file?.path ?? "")
}

export function isMigrationChangedLineFile(filePath) {
  const normalizedPath = String(filePath).replaceAll("\\", "/")
  return CONFIG_MIGRATION_CHANGED_LINE_PATH_PATTERNS.some(pattern => pattern.test(normalizedPath))
}

function getFallbackChangedLineDetails(pullRequest) {
  const additions = Number(pullRequest?.additions) || 0
  const deletions = Number(pullRequest?.deletions) || 0

  return {
    additions,
    changedLines: additions + deletions,
    deletions,
    excludedAdditions: 0,
    excludedChangedLines: 0,
    excludedDeletions: 0,
    excludedFiles: [],
    hasFileBreakdown: false,
  }
}

function getPullRequestChangedLineDetails(pullRequest, pullRequestFiles) {
  if (!Array.isArray(pullRequestFiles))
    return getFallbackChangedLineDetails(pullRequest)

  const details = {
    additions: 0,
    changedLines: 0,
    deletions: 0,
    excludedAdditions: 0,
    excludedChangedLines: 0,
    excludedDeletions: 0,
    excludedFiles: [],
    hasFileBreakdown: true,
  }

  for (const file of pullRequestFiles) {
    const additions = toChangedLineCount(file?.additions)
    const deletions = toChangedLineCount(file?.deletions)
    const changedLines = additions + deletions
    const filePath = getPullRequestFilePath(file)

    if (isMigrationChangedLineFile(filePath)) {
      details.excludedAdditions += additions
      details.excludedChangedLines += changedLines
      details.excludedDeletions += deletions
      details.excludedFiles.push(filePath)
      continue
    }

    details.additions += additions
    details.changedLines += changedLines
    details.deletions += deletions
  }

  return details
}

function formatChangedLineThresholdReason(score, changedLineDetails) {
  const changedLineDescription = changedLineDetails.excludedChangedLines > 0
    ? `${changedLineDetails.changedLines} counted lines after excluding ${changedLineDetails.excludedChangedLines} migration-related lines`
    : `${changedLineDetails.changedLines} lines`

  return `Score ${score.total} is below ${POLICY.autoCloseBelowScore} and the PR changes ${changedLineDescription}, exceeding ${POLICY.autoCloseAboveChangedLines}.`
}

export function planTrustActions({ currentLabels = [], pullRequest = null, pullRequestFiles, score }) {
  const labelSet = new Set(currentLabels)

  if (labelSet.has(POLICY.overrideLabel)) {
    return {
      skipAutomation: true,
      skipReason: `Override label \`${POLICY.overrideLabel}\` is present.`,
      targetTrustLabel: null,
      labelsToAdd: [],
      labelsToRemove: labelSet.has(POLICY.needsMaintainerReviewLabel)
        ? [POLICY.needsMaintainerReviewLabel]
        : [],
      needsMaintainerReview: false,
      shouldClosePr: false,
      closeReason: null,
    }
  }

  const targetTrustLabel = bucketToLabel(score.bucket)
  const needsMaintainerReview = score.total < POLICY.lowScoreThreshold
  const changedLineDetails = getPullRequestChangedLineDetails(pullRequest, pullRequestFiles)

  const labelsToAdd = []
  const labelsToRemove = []

  if (!labelSet.has(targetTrustLabel))
    labelsToAdd.push(targetTrustLabel)

  for (const label of MANAGED_TRUST_LABELS) {
    if (label !== targetTrustLabel && labelSet.has(label))
      labelsToRemove.push(label)
  }

  if (needsMaintainerReview) {
    if (!labelSet.has(POLICY.needsMaintainerReviewLabel))
      labelsToAdd.push(POLICY.needsMaintainerReviewLabel)
  }
  else if (labelSet.has(POLICY.needsMaintainerReviewLabel)) {
    labelsToRemove.push(POLICY.needsMaintainerReviewLabel)
  }

  const shouldClosePr = POLICY.autoCloseBelowScore !== null
    && score.total < POLICY.autoCloseBelowScore
    && changedLineDetails.changedLines > POLICY.autoCloseAboveChangedLines

  return {
    skipAutomation: false,
    skipReason: null,
    targetTrustLabel,
    labelsToAdd: uniqueSorted(labelsToAdd),
    labelsToRemove: uniqueSorted(labelsToRemove),
    needsMaintainerReview,
    changedLineAdditions: changedLineDetails.additions,
    changedLineDeletions: changedLineDetails.deletions,
    changedLines: changedLineDetails.changedLines,
    excludedChangedLineAdditions: changedLineDetails.excludedAdditions,
    excludedChangedLineDeletions: changedLineDetails.excludedDeletions,
    excludedChangedLineFiles: changedLineDetails.excludedFiles,
    excludedChangedLines: changedLineDetails.excludedChangedLines,
    hasFileBreakdown: changedLineDetails.hasFileBreakdown,
    shouldClosePr,
    closeReason: shouldClosePr
      ? formatChangedLineThresholdReason(score, changedLineDetails)
      : null,
  }
}
