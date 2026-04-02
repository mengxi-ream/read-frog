import { bucketToLabel, MANAGED_TRUST_LABELS, POLICY } from "./config.js"

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

export function planTrustActions({ currentLabels = [], score }) {
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

  const shouldClosePr = POLICY.autoCloseBelowScore !== null && score.total < POLICY.autoCloseBelowScore

  return {
    skipAutomation: false,
    skipReason: null,
    targetTrustLabel,
    labelsToAdd: uniqueSorted(labelsToAdd),
    labelsToRemove: uniqueSorted(labelsToRemove),
    needsMaintainerReview,
    shouldClosePr,
    closeReason: shouldClosePr
      ? `Score ${score.total} is below auto-close threshold ${POLICY.autoCloseBelowScore}.`
      : null,
  }
}
