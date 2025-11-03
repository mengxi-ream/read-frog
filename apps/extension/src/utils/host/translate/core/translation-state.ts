import { MARK_ATTRIBUTES } from '../../../constants/dom-labels'

// State management for translation operations
export const translatingNodes = new WeakSet<ChildNode>()
export const originalContentMap = new Map<Element, string>()

// Pre-compiled regex for better performance - removes all mark attributes
export const MARK_ATTRIBUTES_REGEX = new RegExp(`\\s*(?:${Array.from(MARK_ATTRIBUTES).join('|')})(?:=['""][^'"]*['""]|=[^\\s>]*)?`, 'g')
