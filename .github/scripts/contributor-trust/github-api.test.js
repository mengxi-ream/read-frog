import { describe, expect, it } from "vitest"

import { splitTopRepositories } from "./github-api.js"

describe("splitTopRepositories", () => {
  it("keeps non-fork repos for OSS influence and excludes forks", () => {
    const result = splitTopRepositories([
      {
        isFork: true,
        nameWithOwner: "kilidoc/read-frog",
        parent: { nameWithOwner: "mengxi-ream/read-frog" },
        stargazerCount: 5040,
      },
      {
        isFork: false,
        nameWithOwner: "kilidoc/anki-langkit",
        parent: null,
        stargazerCount: 42,
      },
      {
        isFork: false,
        nameWithOwner: "kilidoc/browser-tools",
        parent: null,
        stargazerCount: 5,
      },
    ])

    expect(result).toEqual({
      excludedForkRepositories: [
        {
          isFork: true,
          nameWithOwner: "kilidoc/read-frog",
          parentNameWithOwner: "mengxi-ream/read-frog",
          stargazerCount: 5040,
        },
      ],
      topRepositories: [
        {
          isFork: false,
          nameWithOwner: "kilidoc/anki-langkit",
          parentNameWithOwner: null,
          stargazerCount: 42,
        },
        {
          isFork: false,
          nameWithOwner: "kilidoc/browser-tools",
          parentNameWithOwner: null,
          stargazerCount: 5,
        },
      ],
    })
  })
})
