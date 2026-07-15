import { redirect } from 'next/navigation'

// Force dynamic rendering so this pick is re-rolled on every request rather
// than baked into a single static redirect at build time.
export const dynamic = 'force-dynamic'

const TABS = ['/visualizations/quantity', '/visualizations/coin-type', '/visualizations/mint']

export default function VisualizationsIndexPage() {
  redirect(TABS[Math.floor(Math.random() * TABS.length)])
}
