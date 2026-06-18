import { describe, expect, it } from "vitest";
import { migrate } from "../../migration-scripts/v067-to-v068";
describe("v067-to-v068 migration", () => {
    it("adds floatingButton.locked with a default false value", () => {
        const migrated = migrate({
            floatingButton: {
                enabled: true,
                position: 0.66,
                disabledFloatingButtonPatterns: [],
                clickAction: "translate",
            },
        });
        expect(migrated.floatingButton.locked).toBe(false);
    });
    it("preserves an existing floatingButton.locked value", () => {
        const migrated = migrate({
            floatingButton: {
                enabled: true,
                position: 0.66,
                disabledFloatingButtonPatterns: [],
                clickAction: "translate",
                locked: true,
            },
        });
        expect(migrated.floatingButton.locked).toBe(true);
    });
});
