import { ANALYTICS_FEATURE_USED_EVENT } from "@/utils/constants/analytics";
import { logger } from "@/utils/logger";
import { sendMessage } from "@/utils/message";
export function createFeatureUsageContext(feature, surface, startedAt = Date.now(), metadata) {
    return {
        feature,
        surface,
        startedAt,
        ...metadata,
    };
}
export function getLatencyMs(startedAt, finishedAt = Date.now()) {
    return Math.max(0, finishedAt - startedAt);
}
export function buildFeatureUsedEventProperties({ feature, surface, outcome, startedAt, finishedAt = Date.now(), action_id, action_name, }) {
    return {
        feature,
        surface,
        outcome,
        latency_ms: getLatencyMs(startedAt, finishedAt),
        ...(action_id !== undefined ? { action_id } : {}),
        ...(action_name !== undefined ? { action_name } : {}),
    };
}
export async function trackFeatureUsed(input) {
    try {
        await sendMessage("trackFeatureUsedEvent", buildFeatureUsedEventProperties(input));
    }
    catch (error) {
        if (typeof logger.warn === "function") {
            logger.warn(`[Analytics] Failed to track ${ANALYTICS_FEATURE_USED_EVENT}`, error);
        }
    }
}
export async function trackFeatureAttempt(context, run) {
    try {
        const result = await run();
        void trackFeatureUsed({
            ...context,
            outcome: "success",
        });
        return result;
    }
    catch (error) {
        void trackFeatureUsed({
            ...context,
            outcome: "failure",
        });
        throw error;
    }
}
