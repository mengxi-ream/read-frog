import { describe, expect, it } from "vitest"

import { selectOwnedNonForkRepositories } from "./github-api.js"

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
