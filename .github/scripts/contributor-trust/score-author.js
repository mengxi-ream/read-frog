import { POLICY, TRUST_BUCKETS } from "./config.js"

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
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
  let score = 0

  const commitsInRepo = toNumber(input.commitsInRepo)
  score += commitsInRepo === 0 ? 0 : commitsInRepo <= 5 ? 3 : commitsInRepo <= 20 ? 7 : 10

  const mergedPrs = input.prsInRepo.filter(pr => pr.state === "merged").length
  score += mergedPrs === 0 ? 0 : mergedPrs === 1 ? 3 : mergedPrs <= 5 ? 6 : mergedPrs <= 15 ? 9 : 12

  const reviewsInRepo = toNumber(input.reviewsInRepo)
  score += reviewsInRepo === 0 ? 0 : reviewsInRepo <= 3 ? 3 : reviewsInRepo <= 10 ? 5 : 8

  if (input.isContributor)
    score += 5

  return Math.min(score, 35)
}

function scoreCommunityStanding(input) {
  let score = 0

  const accountMonths = accountAgeMonths(input.accountCreated)
  score += accountMonths < 3 ? 0 : accountMonths < 12 ? 2 : accountMonths < 36 ? 3 : accountMonths < 84 ? 4 : 5

  const followers = toNumber(input.followers)
  score += followers < 10 ? 1 : followers < 50 ? 3 : followers < 200 ? 5 : followers < 1000 ? 7 : 10

  return Math.min(score, 25)
}

function scoreOSSInfluence(input) {
  const topRepoStars = input.topRepoStars.map(toNumber)
  const maxStars = topRepoStars.length > 0 ? Math.max(...topRepoStars) : 0
  const totalStars = topRepoStars.reduce((sum, stars) => sum + stars, 0)

  let score = 0
  score += maxStars === 0 ? 0 : maxStars <= 50 ? 3 : maxStars <= 500 ? 6 : maxStars <= 5000 ? 12 : 15
  score += totalStars < 50 ? 0 : totalStars < 500 ? 2 : 5

  return Math.min(score, 20)
}

function scorePRTrackRecord(input) {
  if (input.prsInRepo.length === 0)
    return 5

  const mergedPrs = input.prsInRepo.filter(pr => pr.state === "merged").length
  const resolvedPrs = input.prsInRepo.filter(pr => pr.state === "merged" || pr.state === "closed").length
  if (resolvedPrs === 0)
    return 5

  const mergeRate = (mergedPrs / resolvedPrs) * 100
  return mergeRate === 0 ? 0 : mergeRate < 50 ? 5 : mergeRate < 75 ? 10 : mergeRate < 90 ? 15 : 20
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
  if (input.isMaintainer) {
    return {
      total: 100,
      repoFamiliarity: 35,
      communityStanding: 25,
      ossInfluence: 20,
      prTrackRecord: 20,
      bucket: TRUST_BUCKETS.HIGHLY_TRUSTED,
      exemptReason: "maintainer",
      lowScoreThreshold: POLICY.lowScoreThreshold,
    }
  }

  const repoFamiliarity = scoreRepoFamiliarity(input)
  const communityStanding = scoreCommunityStanding(input)
  const ossInfluence = scoreOSSInfluence(input)
  const prTrackRecord = scorePRTrackRecord(input)
  const total = repoFamiliarity + communityStanding + ossInfluence + prTrackRecord

  return {
    total,
    repoFamiliarity,
    communityStanding,
    ossInfluence,
    prTrackRecord,
    bucket: getTrustBucket(total),
    exemptReason: null,
    lowScoreThreshold: POLICY.lowScoreThreshold,
  }
}
