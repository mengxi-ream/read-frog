import { describe, expect, it } from "vitest"

import { TRUST_BUCKETS } from "./config.js"
import { computeContributorScore, getTrustBucket } from "./score-author.js"

function createBaseInput() {
  return {
    accountCreated: "2020-01-01T00:00:00Z",
    commitsInRepo: 0,
    contributionCount: 0,
    followers: 0,
    isContributor: false,
    isMaintainer: false,
    prsInRepo: [],
    publicRepos: 0,
    reviewsInRepo: 0,
    topRepoStars: [],
  }
}

describe("getTrustBucket", () => {
  it("maps score boundaries to the expected bucket", () => {
    expect(getTrustBucket(80)).toBe(TRUST_BUCKETS.HIGHLY_TRUSTED)
    expect(getTrustBucket(79)).toBe(TRUST_BUCKETS.TRUSTED)
    expect(getTrustBucket(60)).toBe(TRUST_BUCKETS.TRUSTED)
    expect(getTrustBucket(59)).toBe(TRUST_BUCKETS.MODERATE)
    expect(getTrustBucket(30)).toBe(TRUST_BUCKETS.MODERATE)
    expect(getTrustBucket(29)).toBe(TRUST_BUCKETS.NEW)
  })
})

describe("computeContributorScore", () => {
  it("gives maintainers a full trust exemption", () => {
    const score = computeContributorScore({
      ...createBaseInput(),
      isMaintainer: true,
    })

    expect(score).toMatchObject({
      bucket: TRUST_BUCKETS.HIGHLY_TRUSTED,
      communityStanding: 25,
      exemptReason: "maintainer",
      ossInfluence: 20,
      prTrackRecord: 20,
      repoFamiliarity: 35,
      total: 100,
    })
  })

  it("keeps first-time contributors in the new bucket with the neutral PR history score", () => {
    const score = computeContributorScore(createBaseInput())

    expect(score.total).toBe(10)
    expect(score.prTrackRecord).toBe(5)
    expect(score.bucket).toBe(TRUST_BUCKETS.NEW)
  })

  it("accumulates the better-hub style dimensions for experienced contributors", () => {
    const score = computeContributorScore({
      ...createBaseInput(),
      commitsInRepo: 24,
      contributionCount: 18,
      followers: 230,
      isContributor: true,
      prsInRepo: [
        ...Array.from({ length: 9 }).fill({ state: "merged" }),
        { state: "closed" },
      ],
      reviewsInRepo: 12,
      topRepoStars: [520, 40, 12],
    })

    expect(score).toMatchObject({
      bucket: TRUST_BUCKETS.HIGHLY_TRUSTED,
      communityStanding: 11,
      ossInfluence: 17,
      prTrackRecord: 20,
      repoFamiliarity: 32,
      total: 80,
    })
  })
})
