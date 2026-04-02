import { describe, expect, it } from "vitest"

import { POLICY } from "./config.js"
import { planTrustActions } from "./plan-actions.js"

describe("planTrustActions", () => {
  it("assigns the low-trust labels for new contributors", () => {
    const plan = planTrustActions({
      currentLabels: [],
      score: {
        bucket: "new",
        exemptReason: null,
        total: 18,
      },
    })

    expect(plan).toMatchObject({
      labelsToAdd: ["contrib-trust:new", POLICY.needsMaintainerReviewLabel].sort(),
      labelsToRemove: [],
      needsMaintainerReview: true,
      shouldClosePr: false,
      skipAutomation: false,
      targetTrustLabel: "contrib-trust:new",
    })
  })

  it("cleans up stale trust labels when the score improves", () => {
    const plan = planTrustActions({
      currentLabels: ["contrib-trust:new", POLICY.needsMaintainerReviewLabel],
      score: {
        bucket: "trusted",
        exemptReason: null,
        total: 74,
      },
    })

    expect(plan).toMatchObject({
      labelsToAdd: ["contrib-trust:trusted"],
      labelsToRemove: [POLICY.needsMaintainerReviewLabel, "contrib-trust:new"].sort(),
      needsMaintainerReview: false,
      skipAutomation: false,
      targetTrustLabel: "contrib-trust:trusted",
    })
  })

  it("uses the admin label for exempt scores", () => {
    const plan = planTrustActions({
      currentLabels: ["contrib-trust:new"],
      score: {
        bucket: "highly-trusted",
        exemptReason: "admin",
        total: 100,
      },
    })

    expect(plan).toMatchObject({
      labelsToAdd: [POLICY.adminLabel],
      labelsToRemove: ["contrib-trust:new"],
      needsMaintainerReview: false,
      skipAutomation: false,
      targetTrustLabel: POLICY.adminLabel,
    })
  })

  it("short-circuits when the override label is present", () => {
    const plan = planTrustActions({
      currentLabels: [POLICY.overrideLabel, POLICY.needsMaintainerReviewLabel, "contrib-trust:new"],
      score: {
        bucket: "new",
        exemptReason: null,
        total: 10,
      },
    })

    expect(plan).toMatchObject({
      labelsToAdd: [],
      labelsToRemove: [POLICY.needsMaintainerReviewLabel],
      needsMaintainerReview: false,
      shouldClosePr: false,
      skipAutomation: true,
      targetTrustLabel: null,
    })
  })
})
