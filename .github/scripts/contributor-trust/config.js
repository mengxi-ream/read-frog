export const COMMENT_MARKER = "contributor-trust-score:v1"
export const COMMENT_MARKER_HTML = `<!-- ${COMMENT_MARKER} -->`
export const FINGERPRINT_MARKER_PREFIX = "contributor-trust-fingerprint:"
export const MANAGED_COMMENT_AUTHOR = "github-actions[bot]"
export const TRUST_LABEL_PREFIX = "contrib-trust:"

export const POLICY = Object.freeze({
  version: "v1.1",
  lowScoreThreshold: 30,
  autoCloseBelowScore: 20,
  autoCloseAboveChangedLines: 1000,
  overrideLabel: "trust-check:skip",
  needsMaintainerReviewLabel: "needs-maintainer-review",
  adminLabel: `${TRUST_LABEL_PREFIX}admin`,
  repoFamiliarityBonusPermissions: ["admin", "maintain", "write"],
  reviewQueryPageSize: 50,
})

export const TRUST_BUCKETS = Object.freeze({
  HIGHLY_TRUSTED: "highly-trusted",
  TRUSTED: "trusted",
  MODERATE: "moderate",
  NEW: "new",
})

export const BUCKET_LABELS = Object.freeze({
  [TRUST_BUCKETS.HIGHLY_TRUSTED]: `${TRUST_LABEL_PREFIX}highly-trusted`,
  [TRUST_BUCKETS.TRUSTED]: `${TRUST_LABEL_PREFIX}trusted`,
  [TRUST_BUCKETS.MODERATE]: `${TRUST_LABEL_PREFIX}moderate`,
  [TRUST_BUCKETS.NEW]: `${TRUST_LABEL_PREFIX}new`,
})

export const BUCKET_TITLES = Object.freeze({
  [TRUST_BUCKETS.HIGHLY_TRUSTED]: "Highly trusted",
  [TRUST_BUCKETS.TRUSTED]: "Trusted",
  [TRUST_BUCKETS.MODERATE]: "Moderate",
  [TRUST_BUCKETS.NEW]: "New contributor",
})

export const LABEL_DEFINITIONS = Object.freeze({
  [BUCKET_LABELS[TRUST_BUCKETS.HIGHLY_TRUSTED]]: {
    color: "0e8a16",
    description: "PR author trust score is 80-100.",
  },
  [BUCKET_LABELS[TRUST_BUCKETS.TRUSTED]]: {
    color: "1d76db",
    description: "PR author trust score is 60-79.",
  },
  [BUCKET_LABELS[TRUST_BUCKETS.MODERATE]]: {
    color: "fbca04",
    description: "PR author trust score is 30-59.",
  },
  [BUCKET_LABELS[TRUST_BUCKETS.NEW]]: {
    color: "d4c5f9",
    description: "PR author trust score is 0-29.",
  },
  [POLICY.adminLabel]: {
    color: "5319e7",
    description: "Legacy trust label kept for cleanup of old automation runs.",
  },
  [POLICY.needsMaintainerReviewLabel]: {
    color: "b60205",
    description: "Contributor trust automation recommends maintainer review.",
  },
  [POLICY.overrideLabel]: {
    color: "bfd4f2",
    description: "Skip contributor trust automation on this PR.",
  },
})

export const MANAGED_TRUST_LABELS = Object.freeze([
  ...Object.values(BUCKET_LABELS),
  POLICY.adminLabel,
])

export function bucketToLabel(bucket) {
  return BUCKET_LABELS[bucket]
}

export function bucketToTitle(bucket) {
  return BUCKET_TITLES[bucket]
}
