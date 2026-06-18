/**
 * Migration script from v056 to v057
 * Adds `description: ""` to all existing output schema fields in custom features
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots — never import constants or helpers that may change.
 */
export function migrate(oldConfig) {
    const customFeatures = oldConfig.selectionToolbar?.customFeatures;
    if (!Array.isArray(customFeatures)) {
        return oldConfig;
    }
    const migratedFeatures = customFeatures.map((feature) => {
        const outputSchema = Array.isArray(feature.outputSchema)
            ? feature.outputSchema.map((field) => ({
                ...field,
                description: field.description ?? "",
            }))
            : feature.outputSchema;
        return {
            ...feature,
            outputSchema,
        };
    });
    return {
        ...oldConfig,
        selectionToolbar: {
            ...oldConfig.selectionToolbar,
            customFeatures: migratedFeatures,
        },
    };
}
