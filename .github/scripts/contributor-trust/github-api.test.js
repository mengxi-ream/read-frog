import { describe, expect, it } from "vitest"

import {
  countReviewsOnOthersPullRequestsInRepo,
  createContributorMetrics,
  createPullRequestStateList,
  selectOwnedNonForkRepositories,
} from "./github-api.js"

describe("selectOwnedNonForkRepositories", () => {
  it("keeps only repos that the PR author owns and that are not forks", () => {
    const result = selectOwnedNonForkRepositories([
      {
        isFork: true,
        nameWithOwner: "kilidoc/read-frog",
        owner: { login: "kilidoc" },
        stargazerCount: 5040,
      },
      {
        isFork: false,
        nameWithOwner: "kilidoc/anki-langkit",
        owner: { login: "kilidoc" },
        stargazerCount: 42,
      },
      {
        isFork: false,
        nameWithOwner: "kilidoc/browser-tools",
        owner: { login: "kilidoc" },
        stargazerCount: 5,
      },
      {
        isFork: false,
        nameWithOwner: "mengxi-ream/read-frog",
        owner: { login: "mengxi-ream" },
        stargazerCount: 5041,
      },
      {
        isFork: false,
        nameWithOwner: "better-auth/better-auth",
        owner: { login: "better-auth" },
        stargazerCount: 27534,
      },
    ], "kilidoc")

    expect(result).toEqual([
      {
        nameWithOwner: "kilidoc/anki-langkit",
        stargazerCount: 42,
      },
      {
        nameWithOwner: "kilidoc/browser-tools",
        stargazerCount: 5,
      },
    ])
  })
})

describe("createPullRequestStateList", () => {
  it("reconstructs repo PR states from the aggregated counts", () => {
    expect(createPullRequestStateList({
      closedPrs: 1,
      mergedPrs: 2,
      openPrs: 3,
    })).toEqual([
      { state: "merged" },
      { state: "merged" },
      { state: "closed" },
      { state: "open" },
      { state: "open" },
      { state: "open" },
    ])
  })
})

describe("createContributorMetrics", () => {
  it("keeps the contributor bonus inputs but does not invent commit counts", () => {
    expect(createContributorMetrics({
      author: {
        createdAt: "2020-01-01T00:00:00Z",
        followers: 12,
      },
      permission: "write",
      repoHistory: {
        closedPrs: 1,
        mergedPrs: 2,
        openPrs: 0,
        reviews: 3,
        topRepositories: [
          { nameWithOwner: "kilidoc/browser-tools", stargazerCount: 42 },
        ],
      },
    })).toEqual({
      accountCreated: "2020-01-01T00:00:00Z",
      contributionCount: 5,
      followers: 12,
      isContributor: true,
      prsInRepo: [
        { state: "merged" },
        { state: "merged" },
        { state: "closed" },
      ],
      repoPermission: "write",
      reviewsInRepo: 3,
      topRepoStars: [42],
    })
  })
})

describe("countReviewsOnOthersPullRequestsInRepo", () => {
  it("counts only reviews left on pull requests authored by someone else", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => new Response(JSON.stringify({
      data: {
        search: {
          nodes: [
            {
              __typename: "PullRequest",
              author: { login: "someone-else" },
            },
            {
              __typename: "PullRequest",
              author: { login: "Sufyr" },
            },
            {
              __typename: "PullRequest",
              author: { login: "another-user" },
            },
          ],
          pageInfo: {
            endCursor: null,
            hasNextPage: false,
          },
        },
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })

    try {
      const count = await countReviewsOnOthersPullRequestsInRepo(
        "token",
        "mengxi-ream",
        "read-frog",
        "Sufyr",
        50,
      )

      expect(count).toBe(2)
    }
    finally {
      globalThis.fetch = originalFetch
    }
  })
})
