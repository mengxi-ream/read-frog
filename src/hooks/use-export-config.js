import { useMutation } from "@tanstack/react-query";
import { kebabCase } from "case-anything";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { i18n } from "#imports";
import { getObjectWithoutAPIKeys } from "@/utils/config/api";
import { APP_NAME } from "@/utils/constants/app";
export function useExportConfig({ config, schemaVersion, onSuccess }) {
    return useMutation({
        mutationFn: async (includeApiKeys) => {
            let exportConfig = config;
            if (!includeApiKeys) {
                exportConfig = getObjectWithoutAPIKeys(config);
            }
            const json = JSON.stringify({
                config: exportConfig,
                schemaVersion,
            }, null, 2);
            const blob = new Blob([json], { type: "text/json" });
            saveAs(blob, `${kebabCase(APP_NAME)}-config-v${schemaVersion}.json`);
        },
        onSuccess: () => {
            toast.success(i18n.t("options.config.sync.exportSuccess"));
            onSuccess?.();
        },
    });
}
