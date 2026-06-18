import { deepmerge } from "deepmerge-ts";
export function migrate(oldConfig) {
    return deepmerge(oldConfig, {
        translate: {
            page: {
                autoTranslatePatterns: ["news.ycombinator.com"],
            },
        },
    });
}
