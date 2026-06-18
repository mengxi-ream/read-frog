import { dequal } from "dequal";
import { configSchema } from "@/types/config/config";
import { logger } from "../logger";
/**
 * Recursively detect changes between base, local, and remote configs
 * Returns draft config (base + same-changes, conflicts keep base value) and list of conflicts
 */
export function detectConflicts(base, local, remote) {
    const conflicts = [];
    const isAtomicValue = (val) => val == null || typeof val !== "object" || Array.isArray(val);
    function traverse(basePath, baseVal, localVal, remoteVal) {
        // Handle atomic values (primitives, nulls, arrays)
        if (isAtomicValue(baseVal) || isAtomicValue(localVal) || isAtomicValue(remoteVal)) {
            const localChanged = !dequal(localVal, baseVal);
            const remoteChanged = !dequal(remoteVal, baseVal);
            if (localChanged && remoteChanged) {
                if (dequal(localVal, remoteVal)) {
                    // Both changed to same value - auto apply
                    return localVal;
                }
                else {
                    // Both changed to different values - conflict
                    conflicts.push({
                        path: basePath,
                        baseValue: baseVal,
                        localValue: localVal,
                        remoteValue: remoteVal,
                    });
                    // Keep base value until user resolves
                    return baseVal;
                }
            }
            else if (localChanged) {
                // Only local changed - track as conflict for user to confirm
                conflicts.push({
                    path: basePath,
                    baseValue: baseVal,
                    localValue: localVal,
                    remoteValue: remoteVal,
                });
                // Keep base value until user resolves
                return baseVal;
            }
            else if (remoteChanged) {
                // Only remote changed - track as conflict for user to confirm
                conflicts.push({
                    path: basePath,
                    baseValue: baseVal,
                    localValue: localVal,
                    remoteValue: remoteVal,
                });
                // Keep base value until user resolves
                return baseVal;
            }
            else {
                // No change
                return baseVal;
            }
        }
        // Handle objects - recurse into properties
        const result = {};
        const allKeys = new Set([
            ...Object.keys(baseVal),
            ...Object.keys(localVal),
            ...Object.keys(remoteVal),
        ]);
        for (const key of allKeys) {
            result[key] = traverse([...basePath, key], baseVal[key], localVal[key], remoteVal[key]);
        }
        return result;
    }
    const draft = traverse([], base, local, remote);
    return {
        draft,
        conflicts,
    };
}
/**
 * Apply a resolution to a field conflict
 */
function applyFieldResolution(result, conflict, resolution) {
    // Navigate to the parent object
    let current = result;
    for (let i = 0; i < conflict.path.length - 1; i++) {
        current = current[conflict.path[i]];
    }
    // Set the resolved value
    const lastKey = conflict.path.at(-1);
    current[lastKey] = resolution === "local" ? conflict.localValue : conflict.remoteValue;
}
/**
 * Apply user resolutions to the draft config
 * All conflicts must have resolutions
 */
export function applyResolutions(diffConflictsResult, resolutions) {
    // Deep clone the draft result to avoid mutating original
    const result = structuredClone(diffConflictsResult.draft);
    // Apply resolutions for conflicts
    for (const conflict of diffConflictsResult.conflicts) {
        const pathKey = conflict.path.join(".");
        const resolution = resolutions[pathKey];
        if (!resolution) {
            continue;
        }
        applyFieldResolution(result, conflict, resolution);
    }
    const validatedResult = configSchema.safeParse(result);
    if (!validatedResult.success) {
        logger.error("Resolved config is invalid", validatedResult.error);
        return {
            config: result,
            validationError: validatedResult.error,
        };
    }
    return {
        config: validatedResult.data,
        validationError: null,
    };
}
