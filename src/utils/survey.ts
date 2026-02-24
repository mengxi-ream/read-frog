import { storage } from "#imports"

const LAST_VIEWED_SURVEY_KEY = "lastViewedSurvey"

/**
 * Saves the last viewed survey URL to storage
 */
export async function saveLastViewedSurvey(surveyUrl: string): Promise<void> {
  await storage.setItem(`local:${LAST_VIEWED_SURVEY_KEY}`, surveyUrl)
}

/**
 * Retrieves the last viewed survey URL from storage
 */
export async function getLastViewedSurvey(): Promise<string | null> {
  return await storage.getItem<string>(`local:${LAST_VIEWED_SURVEY_KEY}`)
}

/**
 * Checks if there's a new survey by comparing last viewed survey URL with current survey URL
 * @param lastViewedSurveyUrl - The URL of the last survey the user viewed
 * @param currentSurveyUrl - The URL of the current survey
 * @returns true if the survey has not been viewed yet
 */
export function hasNewSurvey(
  lastViewedSurveyUrl: string | null,
  currentSurveyUrl: string,
): boolean {
  if (!lastViewedSurveyUrl) {
    return true
  }
  return lastViewedSurveyUrl !== currentSurveyUrl
}
