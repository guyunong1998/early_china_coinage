'use client'

import { usePathname } from 'next/navigation'
import { SiteFooter } from '@/components/layout/SiteFooter'

const FULL_VIEWPORT_PATHS = ['/visualizations/quantity', '/visualizations/coin-type', '/visualizations/mint']

/** Full-viewport pages (map visualization tabs backed by FindSpotsMap) omit
 * the site footer so the canvas can fill the screen. */
export function ConditionalFooter() {
  const pathname = usePathname()
  if (FULL_VIEWPORT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null
  return <SiteFooter />
}
