import { MARK_ATTRIBUTES } from "../../../constants/dom-labels";
// State management for translation operations
export const translatingNodes = new WeakSet();
export const originalContentMap = new Map();
// Pre-compiled regex for better performance - removes all mark attributes
export const MARK_ATTRIBUTES_REGEX = new RegExp(`\\s*(?:${[...MARK_ATTRIBUTES].join("|")})(?:=['""][^'"]*['""]|=[^\\s>]*)?`, "g");
