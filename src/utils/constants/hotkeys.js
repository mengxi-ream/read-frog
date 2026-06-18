export const HOTKEYS = ["control", "alt", "shift", "backtick", "clickAndHold"];
export const HOTKEY_ICONS = {
    control: "⌃",
    alt: "⌥",
    shift: "⇧",
    backtick: "`",
    clickAndHold: "⏱",
};
// Maps to actual keyboard event key (for keydown/keyup detection)
export const HOTKEY_EVENT_KEYS = {
    control: "Control",
    alt: "Alt",
    shift: "Shift",
    backtick: "`",
    clickAndHold: "ClickAndHold", // Special handling, not a keyboard event
};
