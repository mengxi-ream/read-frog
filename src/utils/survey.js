import { storage } from "#imports";
const LAST_VIEWED_SURVEY_KEY = "lastViewedSurvey";
/**
 * Saves the last viewed survey URL to storage
 */
export async function saveLastViewedSurvey(surveyUrl) {
    await storage.setItem(`local:${LAST_VIEWED_SURVEY_KEY}`, surveyUrl);
}
/**
 * Retrieves the last viewed survey URL from storage
 */
export async function getLastViewedSurvey() {
    return await storage.getItem(`local:${LAST_VIEWED_SURVEY_KEY}`);
}
/**
 * Checks if there's a new survey by comparing last viewed survey URL with current survey URL
 * @param lastViewedSurveyUrl - The URL of the last survey the user viewed
 * @param currentSurveyUrl - The URL of the current survey
 * @returns true if the survey has not been viewed yet
 */
export function hasNewSurvey(lastViewedSurveyUrl, currentSurveyUrl) {
    if (!lastViewedSurveyUrl) {
        return true;
    }
    return lastViewedSurveyUrl !== currentSurveyUrl;
}
