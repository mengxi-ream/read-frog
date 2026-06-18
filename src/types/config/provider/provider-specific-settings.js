import { z } from "zod";
export const bedrockProviderSpecificSettingsSchema = z.strictObject({
    region: z.string().trim().min(1).meta({
        providerSettingUi: {
            labelKey: "region",
            type: "text",
            placeholder: "us-east-1",
        },
    }),
});
export const PROVIDER_SPECIFIC_SETTINGS_SCHEMAS = {
    bedrock: bedrockProviderSpecificSettingsSchema,
};
export function getProviderSpecificSettingFields(schema) {
    return Object.entries(schema.shape).map(([key, fieldSchema]) => {
        const ui = fieldSchema.meta()?.providerSettingUi;
        if (!ui) {
            throw new Error(`providerSpecificSettings.${key} is missing providerSettingUi metadata`);
        }
        if (ui.type !== "text") {
            throw new Error(`Unsupported providerSpecificSettings.${key} field type: ${String(ui.type)}`);
        }
        return {
            key,
            labelKey: ui.labelKey,
            type: ui.type,
            placeholder: ui.placeholder,
        };
    });
}
