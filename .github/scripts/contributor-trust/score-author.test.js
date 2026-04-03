import { describe, expect, it } from "vitest"

import { TRUST_BUCKETS } from "./config.js"
import { computeContributorScore, getTrustBucket } from "./score-author.js"

function createBaseInput() {
  return {
    accountCreated: "2020-01-01T00:00:00Z",
    contributionCount: 0,
    followers: 0,
    isContributor: false,
    prsInRepo: [],
    repoPermission: null,
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
  it("does not grant any direct trust exemption to repo admins", () => {
    const score = computeContributorScore({
      ...createBaseInput(),
      repoPermission: "admin",
    })

    expect(score).toMatchObject({
      bucket: TRUST_BUCKETS.NEW,
      communityStanding: 15,
      prTrackRecord: 5,
      repoFamiliarity: 0,
      total: 20,
    })
  })

  it("keeps first-time contributors in the new bucket with the neutral PR history score", () => {
    const score = computeContributorScore(createBaseInput())

    expect(score.total).toBe(10)
    expect(score.prTrackRecord).toBe(5)
    expect(score.bucket).toBe(TRUST_BUCKETS.NEW)
  })

  it("does not over-reward a single merged PR", () => {
    const score = computeContributorScore({
      ...createBaseInput(),
      contributionCount: 1,
      isContributor: true,
      prsInRepo: [{ state: "merged" }],
    })

    expect(score.prTrackRecord).toBe(4)
    expect(score.repoFamiliarity).toBe(8)
  })

  it("accumulates the better-hub style dimensions for experienced contributors", () => {
    const score = computeContributorScore({
      ...createBaseInput(),
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
      bucket: TRUST_BUCKETS.TRUSTED,
      communityStanding: 11,
      ossInfluence: 17,
      prTrackRecord: 17,
      repoFamiliarity: 22,
      total: 67,
    })
  })

  it("approaches a high track record score only after enough resolved PRs", () => {
    const score = computeContributorScore({
      ...createBaseInput(),
      contributionCount: 10,
      followers: 12,
      isContributor: true,
      prsInRepo: Array.from({ length: 10 }).fill({ state: "merged" }),
    })

    expect(score.prTrackRecord).toBe(18)
  })

  it("adds the full community standing bonus for admin, maintain, and write access", () => {
    for (const repoPermission of ["admin", "maintain", "write"]) {
      const score = computeContributorScore({
        ...createBaseInput(),
        repoPermission,
      })

      expect(score.communityStanding).toBe(15)
    }
  })
})
