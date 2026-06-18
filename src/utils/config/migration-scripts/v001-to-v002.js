import { deepmerge } from "deepmerge-ts";
export function migrate(oldConfig) {
    return deepmerge(oldConfig, {
        pageTranslate: {
            range: "mainContent",
        },
    });
}
