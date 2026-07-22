import { HeroBanner } from '@/components/home/HeroBanner'
import { NavCards } from '@/components/home/NavCards'
import { DemoVisualizationsCarousel } from '@/components/home/DemoVisualizationsCarousel'

export default function Home() {
  return (
    <>
      <HeroBanner />

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <NavCards />
        </div>
        <DemoVisualizationsCarousel />
      </div>
    </>
  )
}
