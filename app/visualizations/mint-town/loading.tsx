import { MapLoadingOverlay } from '@/components/visualizations/MapLoadingOverlay'

export default function MintTownLoading() {
  return (
    <div className="relative h-[calc(100dvh-4.5rem)] overflow-hidden">
      <MapLoadingOverlay />
    </div>
  )
}
