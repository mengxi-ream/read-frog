import { MacBrowserShell } from '@/components/mac-browser-shell'

export function Demo() {
  return (
    <div className="flex flex-col overflow-hidden">
      <FeatureDemo />
      <FeatureTabs />
    </div>
  )
}

function FeatureDemo() {
  return (
    <MacBrowserShell
      url="https://www.apple.com"
      className="max-w-3xl md:max-w-6xl"
    >
      <div className="p-8 text-center">
      </div>
    </MacBrowserShell>
  )
}

function FeatureTabs() {
  return <div></div>
}
