import { describe, expect, it } from "vitest"

import { findManagedTrustComment, isManagedTrustComment } from "./managed-comment.js"

describe("managed trust comments", () => {
  it("only matches marker comments authored by github-actions[bot]", () => {
    const foreignComment = {
      body: "<!-- contributor-trust-score:v1 -->\nspoofed marker",
      id: 1,
      user: { login: "malicious-user" },
    }
    const managedComment = {
      body: "<!-- contributor-trust-score:v1 -->\nmanaged marker",
      id: 2,
      user: { login: "github-actions[bot]" },
    }

    expect(isManagedTrustComment(foreignComment)).toBe(false)
    expect(isManagedTrustComment(managedComment)).toBe(true)
    expect(findManagedTrustComment([foreignComment, managedComment])).toEqual(managedComment)
  })
})
