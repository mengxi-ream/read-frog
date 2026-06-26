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
        commitsInRepo: 14,
        followers: 3,
        mergedPrs: 1,
        openPrs: 0,
        repoPermission: "write",
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
        changedLineAdditions: 820,
        changedLineDeletions: 245,
        changedLines: 1065,
        excludedChangedLineAdditions: 1662,
        excludedChangedLineDeletions: 0,
        excludedChangedLines: 1662,
        needsMaintainerReview: false,
        targetTrustLabel: "contrib-trust:trusted",
      },
      pullRequest: {
        additions: 820,
        deletions: 245,
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

    expect(comment.body).toContain("stars on owned non-fork repositories")
    expect(comment.body).toContain("Repo commits: 14")
    expect(comment.body).toContain("PR counted changed lines: 1065 (+820 / -245)")
    expect(comment.body).toContain("Migration-related changed lines excluded: 1662 (+1662 / -0)")
    expect(comment.body).toContain("Repo permission: write")
    expect(comment.body).toContain("Auto-close: score < 20 and counted changed lines > 1000")
    expect(comment.body).toContain("Migration-related files are excluded from the auto-close line count")
    expect(comment.body).toContain("Owned non-fork repos considered: max 42, total 42 (kilidoc/browser-tools (42))")
    expect(comment.body).not.toContain("Fork repos excluded from OSS influence")
    expect(comment.body).not.toContain("Public repos:")
  })
})
