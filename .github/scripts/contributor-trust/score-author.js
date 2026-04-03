import { POLICY, TRUST_BUCKETS } from "./config.js"

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function roundNumber(value, digits = 2) {
  if (!Number.isFinite(value))
    return 0

  return Number(value.toFixed(digits))
}

function accountAgeMonths(createdAt) {
  if (!createdAt)
    return 0

  const timestamp = new Date(createdAt).getTime()
  if (Number.isNaN(timestamp))
    return 0

  return (Date.now() - timestamp) / 2.628e9
}

function scoreRepoFamiliarity(input) {
  const commitsInRepo = toNumber(input.commitsInRepo)
  const commitPoints = commitsInRepo === 0 ? 0 : commitsInRepo <= 5 ? 3 : commitsInRepo <= 20 ? 7 : 10

  const mergedPrs = input.prsInRepo.filter(pr => pr.state === "merged").length
  const mergedPrPoints = mergedPrs === 0 ? 0 : mergedPrs === 1 ? 3 : mergedPrs <= 5 ? 6 : mergedPrs <= 15 ? 9 : 12

  const reviewsInRepo = toNumber(input.reviewsInRepo)
  const reviewPoints = reviewsInRepo === 0 ? 0 : reviewsInRepo <= 3 ? 3 : reviewsInRepo <= 10 ? 5 : 8

  const contributorBonus = input.isContributor ? 5 : 0
  const score = commitPoints + mergedPrPoints + reviewPoints + contributorBonus

  return {
    score: Math.min(score, 35),
    details: {
      achievableMax: 35,
      commitsInRepo: {
        count: commitsInRepo,
        maxPoints: 10,
        points: commitPoints,
      },
      configuredMax: 35,
      contributorBonus: {
        eligible: Boolean(input.isContributor),
        maxPoints: 5,
        points: contributorBonus,
      },
      mergedPrs: {
        count: mergedPrs,
        maxPoints: 12,
        points: mergedPrPoints,
      },
      reviewsInRepo: {
        count: reviewsInRepo,
        maxPoints: 8,
        points: reviewPoints,
      },
    },
  }
}

function scoreCommunityStanding(input) {
  const accountMonths = accountAgeMonths(input.accountCreated)
  const accountAgePoints = accountMonths < 3 ? 0 : accountMonths < 12 ? 2 : accountMonths < 36 ? 3 : accountMonths < 84 ? 4 : 5

  const followers = toNumber(input.followers)
  const followerPoints = followers < 10 ? 1 : followers < 50 ? 3 : followers < 200 ? 5 : followers < 1000 ? 7 : 10

  const permissionBonus = POLICY.repoFamiliarityBonusPermissions.includes(input.repoPermission ?? "") ? 10 : 0
  const score = accountAgePoints + followerPoints + permissionBonus

  return {
    score: Math.min(score, 25),
    details: {
      achievableMax: 25,
      accountAge: {
        maxPoints: 5,
        months: roundNumber(accountMonths, 1),
        points: accountAgePoints,
      },
      configuredMax: 25,
      followers: {
        count: followers,
        maxPoints: 10,
        points: followerPoints,
      },
      repoPermission: {
        bonusEligible: POLICY.repoFamiliarityBonusPermissions.includes(input.repoPermission ?? ""),
        maxPoints: 10,
        permission: input.repoPermission ?? "none",
        points: permissionBonus,
      },
    },
  }
}

function scoreOSSInfluence(input) {
  const topRepoStars = input.topRepoStars.map(toNumber)
  const maxStars = topRepoStars.length > 0 ? Math.max(...topRepoStars) : 0
  const totalStars = topRepoStars.reduce((sum, stars) => sum + stars, 0)

  const maxRepoPoints = maxStars === 0 ? 0 : maxStars <= 50 ? 3 : maxStars <= 500 ? 6 : maxStars <= 5000 ? 12 : 15
  const totalRepoPoints = totalStars < 50 ? 0 : totalStars < 500 ? 2 : 5
  const score = maxRepoPoints + totalRepoPoints

  return {
    score: Math.min(score, 20),
    details: {
      achievableMax: 20,
      configuredMax: 20,
      maxOwnedRepoStars: {
        count: maxStars,
        maxPoints: 15,
        points: maxRepoPoints,
      },
      totalOwnedRepoStars: {
        count: totalStars,
        maxPoints: 5,
        points: totalRepoPoints,
      },
    },
  }
}

function scorePRTrackRecord(input) {
  if (input.prsInRepo.length === 0) {
    return {
      score: 5,
      details: {
        achievableMax: 20,
        configuredMax: 20,
        confidence: 0,
        mergedPrs: 0,
        points: 5,
        reason: "no-pr-history",
        resolvedPrs: 0,
        smoothedRate: 0,
      },
    }
  }

  const mergedPrs = input.prsInRepo.filter(pr => pr.state === "merged").length
  const resolvedPrs = input.prsInRepo.filter(pr => pr.state === "merged" || pr.state === "closed").length
  if (resolvedPrs === 0) {
    return {
      score: 5,
      details: {
        achievableMax: 20,
        configuredMax: 20,
        confidence: 0,
        mergedPrs,
        points: 5,
        reason: "no-resolved-prs",
        resolvedPrs,
        smoothedRate: 0,
      },
    }
  }

  const smoothedRate = (mergedPrs + 1) / (resolvedPrs + 2)
  const confidence = Math.min(1, Math.log2(resolvedPrs + 1) / Math.log2(11))

  return {
    score: Math.round(20 * smoothedRate * confidence),
    details: {
      achievableMax: 20,
      configuredMax: 20,
      confidence: roundNumber(confidence, 4),
      mergedPrs,
      points: Math.round(20 * smoothedRate * confidence),
      reason: "resolved-pr-history",
      resolvedPrs,
      smoothedRate: roundNumber(smoothedRate, 4),
    },
  }
}

export function getTrustBucket(total) {
  if (total >= 80)
    return TRUST_BUCKETS.HIGHLY_TRUSTED
  if (total >= 60)
    return TRUST_BUCKETS.TRUSTED
  if (total >= 30)
    return TRUST_BUCKETS.MODERATE
  return TRUST_BUCKETS.NEW
}

export function computeContributorScore(input) {
  const repoFamiliarity = scoreRepoFamiliarity(input)
  const communityStanding = scoreCommunityStanding(input)
  const ossInfluence = scoreOSSInfluence(input)
  const prTrackRecord = scorePRTrackRecord(input)
  const total = repoFamiliarity.score + communityStanding.score + ossInfluence.score + prTrackRecord.score
  const achievableMax = [
    repoFamiliarity.details.achievableMax,
    communityStanding.details.achievableMax,
    ossInfluence.details.achievableMax,
    prTrackRecord.details.achievableMax,
  ].reduce((sum, value) => sum + value, 0)

  return {
    breakdown: {
      communityStanding: communityStanding.details,
      ossInfluence: ossInfluence.details,
      prTrackRecord: prTrackRecord.details,
      repoFamiliarity: repoFamiliarity.details,
      total: {
        achievableMax,
        configuredMax: 100,
      },
    },
    total,
    repoFamiliarity: repoFamiliarity.score,
    communityStanding: communityStanding.score,
    ossInfluence: ossInfluence.score,
    prTrackRecord: prTrackRecord.score,
    bucket: getTrustBucket(total),
    lowScoreThreshold: POLICY.lowScoreThreshold,
  }
}
