import { FullViewportMapShell } from '@/components/visualizations/FullViewportMapShell'
import { MapLoadingOverlay } from '@/components/visualizations/MapLoadingOverlay'

export default function FindSiteLoading() {
  return (
    <FullViewportMapShell>
      <MapLoadingOverlay />
    </FullViewportMapShell>
  )
}
