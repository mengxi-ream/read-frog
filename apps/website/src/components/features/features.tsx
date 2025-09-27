import { CustomApiKey } from './custom-api-key'
import { LittleFeatureGrid } from './little-feature-grid'
import { PageTranslation } from './page-translation'
import { SelectionTextTranslate } from './selection-text-translate'
import { SupportProviders } from './support-providers'

export function Features() {
  return (
    <>
      <PageTranslation />
      <SupportProviders />
      <CustomApiKey />
      <SelectionTextTranslate />
      <LittleFeatureGrid />
    </>
  )
}
