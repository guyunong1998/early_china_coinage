'use client'

import { usePathname } from 'next/navigation'
import { SiteFooter } from '@/components/layout/SiteFooter'

/** Full-viewport pages (map) omit the site footer so the canvas can fill the screen. */
export function ConditionalFooter() {
  const pathname = usePathname()
  if (pathname === '/map' || pathname.startsWith('/map/')) return null
  return <SiteFooter />
}
