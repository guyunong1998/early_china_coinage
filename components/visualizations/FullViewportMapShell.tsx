type FullViewportMapShellProps = {
  children: React.ReactNode
}

/** Full-viewport wrapper shared by every map-visualization page.tsx and its
 * sibling loading.tsx (museum-collections, visualizations/find-site,
 * visualizations/mint-town) — fills the space below the site header. */
export function FullViewportMapShell({ children }: FullViewportMapShellProps) {
  return <div className="relative h-[calc(100dvh-4rem)] overflow-hidden">{children}</div>
}
