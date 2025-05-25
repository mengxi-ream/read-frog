import { registerNodeTranslationTriggers } from './node-translation'
import { registerPageTranslationTriggers } from './page-translation'

export function registerTranslationTriggers() {
  registerNodeTranslationTriggers()
  registerPageTranslationTriggers()
}
