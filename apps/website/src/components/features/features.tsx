import { LittleFeatureGrid } from '@/components/features/little-feature-grid'
import { SupportProviders } from '@/components/features/support-providers'

export function Features() {
  return (
    <div className="flex flex-col">
      <SupportProviders />
      <LittleFeatureGrid />
    </div>
  )
}
