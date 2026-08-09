/**
 * Shared by convert-routes-shapefile.mjs and resnap-route-nodes.mjs.
 *
 * The route lines (route0180.shp) and their named nodes (Node.shp) were
 * digitised independently, so a node meant to mark a stop on a route usually
 * sits some tens to a few hundred metres off the line it belongs to rather
 * than exactly on it. That gap is invisible at low zoom (the route's halo/
 * casing is many times wider than the offset) but opens up into a visible
 * disconnect between the node dot and the line once zoomed in past it.
 *
 * Fix: project each node onto the nearest point of the nearest route
 * segment and move it there, as long as that point is within NODE_SNAP_
 * METERS — nodes farther than that from every route aren't meant to sit on
 * this network at all (a nearby settlement rather than a waypoint) and are
 * left untouched rather than being dragged onto an unrelated line.
 */
export const NODE_SNAP_METERS = 2000

export const metres = (a, b) =>
  Math.hypot((a[0] - b[0]) * Math.cos((a[1] * Math.PI) / 180), a[1] - b[1]) * 111320

/** Closest point to `p` on segment a→b, computed in an equirectangular
 *  approximation (fine at this scale) then interpolated back to lon/lat. */
function closestPointOnSegment(p, a, b) {
  const scaleX = Math.cos((p[1] * Math.PI) / 180)
  const px = (p[0] - a[0]) * scaleX
  const py = p[1] - a[1]
  const dx = (b[0] - a[0]) * scaleX
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / len2))
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
}

export function snapNodesToRoutes(nodeFeatures, routeFeatures, maxMeters = NODE_SNAP_METERS) {
  return nodeFeatures.map((nodeFeature) => {
    const p = nodeFeature.geometry.coordinates
    let best = null
    let bestDist = Infinity
    for (const routeFeature of routeFeatures) {
      const coords = routeFeature.geometry.coordinates
      for (let i = 0; i < coords.length - 1; i++) {
        const candidate = closestPointOnSegment(p, coords[i], coords[i + 1])
        const d = metres(p, candidate)
        if (d < bestDist) {
          bestDist = d
          best = candidate
        }
      }
    }
    if (!best || bestDist > maxMeters) return nodeFeature
    return {
      ...nodeFeature,
      geometry: { ...nodeFeature.geometry, coordinates: best },
    }
  })
}
