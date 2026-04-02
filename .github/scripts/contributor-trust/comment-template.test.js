import { describe, expect, it } from "vitest"

import { buildTrustComment } from "./comment-template.js"

describe("buildTrustComment", () => {
  it("shows named non-fork repositories and excluded fork repos", () => {
    const comment = buildTrustComment({
      author: {
        login: "kilidoc",
        name: "Kilidoc",
        type: "User",
        url: "https://github.com/kilidoc",
      },
      metrics: {
        accountCreated: "2019-01-01T00:00:00Z",
        closedPrs: 0,
        excludedForkRepositories: [
          {
            isFork: true,
            nameWithOwner: "kilidoc/read-frog",
            parentNameWithOwner: "mengxi-ream/read-frog",
            stargazerCount: 5040,
          },
        ],
        followers: 3,
        mergedPrs: 1,
        openPrs: 0,
        publicRepos: 31,
        reviews: 1,
        topRepositories: [
          {
            isFork: false,
            nameWithOwner: "kilidoc/browser-tools",
            parentNameWithOwner: null,
            stargazerCount: 42,
          },
        ],
      },
      owner: "mengxi-ream",
      plan: {
        needsMaintainerReview: false,
        targetTrustLabel: "contrib-trust:trusted",
      },
      pullRequest: {
        number: 1242,
        state: "open",
        title: "fix: storage false value reset and backup delete dialog not showing",
      },
      repo: "read-frog",
      score: {
        bucket: "trusted",
        communityStanding: 6,
        exemptReason: null,
        ossInfluence: 3,
        prTrackRecord: 20,
        repoFamiliarity: 14,
        total: 43,
      },
    })

    expect(comment.body).toContain("stars on top non-fork repositories")
    expect(comment.body).toContain("Top non-fork repos considered: max 42, total 42 (kilidoc/browser-tools (42))")
    expect(comment.body).toContain("Fork repos excluded from OSS influence: kilidoc/read-frog (5040)")
  })
})
