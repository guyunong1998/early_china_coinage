/**
 * Converts the historical route shapefiles into the two GeoJSON files the
 * Find Site map's route overlay reads (see lib/map-layers.ts):
 *
 *   newRoute.shp   → public/data/routes.geojson       (LineString, `routelevel` 1–3)
 *                    (falls back to route0180.shp if newRoute.shp is missing)
 *   Node.shp       → public/data/route-nodes.geojson  (Point, Chinese `name`)
 *
 * DBF text is UTF-8 (newRoute.cpg / route0180.cpg; Node ships no .cpg but is
 * encoded the same way), which is *not* the DBF default — passing the encoding
 * explicitly is what keeps the node names from coming out as mojibake.
 *
 * After reading, the network is cleaned so junctions fuse instead of leaving
 * a knot of overlapping caps, and sharp corners are rounded:
 *   1. Snap near-coincident vertices together
 *   2. Weld nearby endpoints, snap / extend missed T-junctions onto the
 *      line they meet, and split both lines where they actually cross
 *   3. Drop duplicate same-level edges between the same two junctions
 *   4. Concatenate degree-2 runs of the same level into one polyline
 *   5. Round sharp corners (junction vertices stay put so crossings still meet)
 *
 *   node scripts/convert-routes-shapefile.mjs [sourceDir]
 *
 * sourceDir defaults to the user's Documents folder.
 */
import fs from 'fs'
import path from 'path'
import * as shapefile from 'shapefile'
import { snapNodesToRoutes } from './route-node-snap.mjs'

/** Endpoints closer than this become the same junction. */
const ENDPOINT_SNAP_METERS = 500
/** Any vertices this close are treated as the same point. */
const VERTEX_SNAP_METERS = 80
/** An endpoint this close to another line is treated as a missed T-junction. */
const T_SNAP_METERS = 1600
/** If a dangling end is aimed at another line, extend it this far to meet. */
const T_EXTEND_METERS = 2500
/** Same-level edges between the same junctions whose mean offset is below
 *  this are parallel traces of one road — keep one. */
const PARALLEL_METERS = 180
const CORNER_TURN_DEG = 26
const CORNER_CUT = 0.32

const metres = (a, b) =>
  Math.hypot((a[0] - b[0]) * Math.cos((a[1] * Math.PI) / 180), a[1] - b[1]) * 111320

const key = (p) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const clone = (p) => [p[0], p[1]]

function turnDeg(a, b, c) {
  const ax = b[0] - a[0]
  const ay = b[1] - a[1]
  const bx = c[0] - b[0]
  const by = c[1] - b[1]
  const la = Math.hypot(ax, ay)
  const lb = Math.hypot(bx, by)
  if (la === 0 || lb === 0) return 0
  const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))
  return (Math.acos(cos) * 180) / Math.PI
}

function bbox(coords, pad = 0) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of coords) {
    minX = Math.min(minX, p[0])
    maxX = Math.max(maxX, p[0])
    minY = Math.min(minY, p[1])
    maxY = Math.max(maxY, p[1])
  }
  return [minX - pad, minY - pad, maxX + pad, maxY + pad]
}

function bboxOverlap(a, b) {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]
}

function closestOnSegment(p, a, b) {
  const scaleX = Math.cos((p[1] * Math.PI) / 180)
  const px = (p[0] - a[0]) * scaleX
  const py = p[1] - a[1]
  const dx = (b[0] - a[0]) * scaleX
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / len2))
  return { point: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], t }
}

function segIntersect(a, b, c, d) {
  const denom = (d[1] - c[1]) * (b[0] - a[0]) - (d[0] - c[0]) * (b[1] - a[1])
  if (Math.abs(denom) < 1e-18) return null
  const ua = ((d[0] - c[0]) * (a[1] - c[1]) - (d[1] - c[1]) * (a[0] - c[0])) / denom
  const ub = ((b[0] - a[0]) * (a[1] - c[1]) - (b[1] - a[1]) * (a[0] - c[0])) / denom
  if (ua <= 0.02 || ua >= 0.98 || ub <= 0.02 || ub >= 0.98) return null
  return [a[0] + ua * (b[0] - a[0]), a[1] + ua * (b[1] - a[1])]
}

function unionFind(n) {
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const join = (a, b) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }
  return { find, join }
}

function clusterSnap(points, snapMeters) {
  const uf = unionFind(points.length)
  const cell = snapMeters / 111320
  const grid = new Map()
  points.forEach((p, i) => {
    const gx = Math.round(p[0] / cell)
    const gy = Math.round(p[1] / cell)
    const bucket = `${gx},${gy}`
    if (!grid.has(bucket)) grid.set(bucket, [])
    grid.get(bucket).push(i)
  })
  for (const [bucket, ids] of grid) {
    const [gx, gy] = bucket.split(',').map(Number)
    const nearby = []
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        nearby.push(...(grid.get(`${gx + dx},${gy + dy}`) ?? []))
      }
    }
    for (const a of ids) {
      for (const b of nearby) {
        if (b <= a) continue
        if (metres(points[a], points[b]) <= snapMeters) uf.join(a, b)
      }
    }
  }
  const groups = new Map()
  points.forEach((_, i) => {
    const root = uf.find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(i)
  })
  const out = points.map(clone)
  for (const members of groups.values()) {
    if (members.length < 2) continue
    const cx = members.reduce((s, i) => s + points[i][0], 0) / members.length
    const cy = members.reduce((s, i) => s + points[i][1], 0) / members.length
    members.forEach((i) => {
      out[i] = [cx, cy]
    })
  }
  return out
}

function snapAllVertices(lines, snapMeters) {
  const refs = []
  const points = []
  lines.forEach((l, li) => {
    l.coords.forEach((p, pi) => {
      refs.push([li, pi])
      points.push(p)
    })
  })
  const snapped = clusterSnap(points, snapMeters)
  snapped.forEach((p, i) => {
    const [li, pi] = refs[i]
    lines[li].coords[pi] = p
  })
}

function weldEndpoints(lines, snapMeters) {
  const ends = lines.flatMap((l, i) => [
    { i, at: 0 },
    { i, at: l.coords.length - 1 },
  ])
  const pts = ends.map((e) => lines[e.i].coords[e.at])
  const snapped = clusterSnap(pts, snapMeters)
  snapped.forEach((p, i) => {
    lines[ends[i].i].coords[ends[i].at] = p
  })
}

function insertOnLine(coords, point, minMeters = 8) {
  let best = { d: Infinity, i: -1, t: 0, p: point }
  for (let i = 0; i < coords.length - 1; i++) {
    const hit = closestOnSegment(point, coords[i], coords[i + 1])
    const d = metres(point, hit.point)
    if (d < best.d) best = { d, i, t: hit.t, p: hit.point }
  }
  if (best.i < 0) return point
  if (metres(coords[best.i], best.p) <= minMeters) {
    coords[best.i] = best.p
    return best.p
  }
  if (metres(coords[best.i + 1], best.p) <= minMeters) {
    coords[best.i + 1] = best.p
    return best.p
  }
  coords.splice(best.i + 1, 0, best.p)
  return best.p
}

/** False if snapping `target` would fold the last segment back over itself. */
function keepsForward(coords, at, target) {
  const tip = coords[at]
  const prev = at === 0 ? coords[1] : coords[coords.length - 2]
  const ox = tip[0] - prev[0]
  const oy = tip[1] - prev[1]
  const nx = target[0] - prev[0]
  const ny = target[1] - prev[1]
  return ox * nx + oy * ny >= 0
}

function rayHitSegment(origin, prev, a, b) {
  const dx = origin[0] - prev[0]
  const dy = origin[1] - prev[1]
  const ex = b[0] - a[0]
  const ey = b[1] - a[1]
  const denom = dx * ey - dy * ex
  if (Math.abs(denom) < 1e-18) return null
  const t = ((a[0] - origin[0]) * ey - (a[1] - origin[1]) * ex) / denom
  const u = ((a[0] - origin[0]) * dy - (a[1] - origin[1]) * dx) / denom
  if (t <= 0.001 || u < 0 || u > 1) return null
  const point = [origin[0] + t * dx, origin[1] + t * dy]
  return { point, d: metres(origin, point) }
}

function attachEndpoint(coords, at, other, point) {
  if (metres(point, other[0]) <= VERTEX_SNAP_METERS) {
    coords[at] = clone(other[0])
    return
  }
  if (metres(point, other[other.length - 1]) <= VERTEX_SNAP_METERS) {
    coords[at] = clone(other[other.length - 1])
    return
  }
  coords[at] = insertOnLine(other, point)
}

function snapTJunctions(lines, snapMeters, extendMeters) {
  const pad = Math.max(snapMeters, extendMeters) / 90000
  const boxes = lines.map((l) => bbox(l.coords, pad))
  for (let i = 0; i < lines.length; i++) {
    const coords = lines[i].coords
    if (coords.length < 2) continue
    for (const at of [0, coords.length - 1]) {
      const p = coords[at]
      const prev = at === 0 ? coords[1] : coords[coords.length - 2]
      let closest = null
      let ray = null
      for (let j = 0; j < lines.length; j++) {
        if (i === j) continue
        if (!bboxOverlap(boxes[i], boxes[j])) continue
        const other = lines[j].coords
        for (let k = 0; k < other.length - 1; k++) {
          const hit = closestOnSegment(p, other[k], other[k + 1])
          const d = metres(p, hit.point)
          if (d <= snapMeters && (!closest || d < closest.d)) {
            closest = { j, p: hit.point, d }
          }
          const ext = rayHitSegment(p, prev, other[k], other[k + 1])
          if (ext && ext.d <= extendMeters && (!ray || ext.d < ray.d)) {
            ray = { j, p: ext.point, d: ext.d }
          }
        }
      }
      let pick = null
      if (closest && closest.d <= 200) pick = closest
      else if (ray) pick = ray
      else if (closest && keepsForward(coords, at, closest.p)) pick = closest
      if (!pick) continue
      attachEndpoint(coords, at, lines[pick.j].coords, pick.p)
    }
  }
}

function splitAtCrossings(lines) {
  const boxes = lines.map((l) => bbox(l.coords, 0.002))
  const inserts = lines.map(() => [])
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      if (!bboxOverlap(boxes[i], boxes[j])) continue
      const a = lines[i].coords
      const b = lines[j].coords
      for (let ia = 0; ia < a.length - 1; ia++) {
        for (let ib = 0; ib < b.length - 1; ib++) {
          const hit = segIntersect(a[ia], a[ia + 1], b[ib], b[ib + 1])
          if (!hit) continue
          inserts[i].push(hit)
          inserts[j].push(hit)
        }
      }
    }
  }
  inserts.forEach((pts, i) => {
    for (const p of pts) insertOnLine(lines[i].coords, p)
  })
}

function dropTiny(lines, minMeters = 15) {
  return lines.filter((l) => {
    if (l.coords.length < 2) return false
    let len = 0
    for (let i = 1; i < l.coords.length; i++) len += metres(l.coords[i - 1], l.coords[i])
    return len >= minMeters
  })
}

function meanOffset(a, b) {
  const sample = Math.min(8, a.length)
  let sum = 0
  for (let i = 0; i < sample; i++) {
    const t = sample === 1 ? 0 : i / (sample - 1)
    const idx = Math.min(a.length - 1, Math.round(t * (a.length - 1)))
    const p = a[idx]
    let best = Infinity
    for (let j = 0; j < b.length - 1; j++) {
      const hit = closestOnSegment(p, b[j], b[j + 1])
      best = Math.min(best, metres(p, hit.point))
    }
    sum += best
  }
  return sum / sample
}

function dropParallelDuplicates(lines) {
  const byEnds = new Map()
  lines.forEach((l, i) => {
    const a = key(l.coords[0])
    const b = key(l.coords[l.coords.length - 1])
    const pair = a < b ? `${l.level}|${a}|${b}` : `${l.level}|${b}|${a}`
    if (!byEnds.has(pair)) byEnds.set(pair, [])
    byEnds.get(pair).push(i)
  })
  const drop = new Set()
  for (const ids of byEnds.values()) {
    if (ids.length < 2) continue
    for (let x = 0; x < ids.length; x++) {
      if (drop.has(ids[x])) continue
      for (let y = x + 1; y < ids.length; y++) {
        if (drop.has(ids[y])) continue
        const d = meanOffset(lines[ids[x]].coords, lines[ids[y]].coords)
        if (d <= PARALLEL_METERS) drop.add(ids[y])
      }
    }
  }
  return lines.filter((_, i) => !drop.has(i))
}

function mergeDegree2(lines) {
  const merged = []
  for (const level of [...new Set(lines.map((l) => l.level))]) {
    const group = lines.filter((l) => l.level === level)
    const degree = new Map()
    const endpointIndex = new Map()
    group.forEach((l, i) => {
      for (const p of [l.coords[0], l.coords[l.coords.length - 1]]) {
        const k = key(p)
        degree.set(k, (degree.get(k) ?? 0) + 1)
        if (!endpointIndex.has(k)) endpointIndex.set(k, [])
        endpointIndex.get(k).push(i)
      }
    })
    const used = new Set()
    const extend = (coords, forward) => {
      for (;;) {
        const tip = forward ? coords[coords.length - 1] : coords[0]
        if (degree.get(key(tip)) !== 2) return
        const next = (endpointIndex.get(key(tip)) ?? []).find((i) => !used.has(i))
        if (next == null) return
        used.add(next)
        const c = group[next].coords
        const tail = key(c[0]) === key(tip) ? c.slice(1) : c.slice(0, -1).reverse()
        if (forward) coords.push(...tail)
        else coords.unshift(...tail.reverse())
      }
    }
    group.forEach((l, i) => {
      if (used.has(i)) return
      used.add(i)
      const coords = l.coords.map(clone)
      extend(coords, true)
      extend(coords, false)
      merged.push({ level, coords })
    })
  }
  return merged
}

function junctionKeys(lines) {
  const count = new Map()
  for (const l of lines) {
    const seen = new Set()
    for (const p of l.coords) {
      const k = key(p)
      if (seen.has(k)) continue
      seen.add(k)
      count.set(k, (count.get(k) ?? 0) + 1)
    }
  }
  const freeze = new Set()
  for (const [k, n] of count) if (n >= 2) freeze.add(k)
  return freeze
}

function roundCorners(coords, freeze) {
  if (coords.length < 3) return coords.map(clone)
  const out = [clone(coords[0])]
  for (let i = 1; i < coords.length - 1; i++) {
    const p = coords[i]
    if (freeze.has(key(p))) {
      out.push(clone(p))
      continue
    }
    if (turnDeg(coords[i - 1], p, coords[i + 1]) < CORNER_TURN_DEG) {
      out.push(clone(p))
      continue
    }
    out.push(lerp(p, coords[i - 1], CORNER_CUT))
    out.push(lerp(p, coords[i + 1], CORNER_CUT))
  }
  out.push(clone(coords[coords.length - 1]))
  return out
}

function toFeatures(lines) {
  return lines
    .filter((l) => l.coords.length >= 2)
    .map((l) => ({
      type: 'Feature',
      properties: { routelevel: l.level },
      geometry: { type: 'LineString', coordinates: l.coords },
    }))
}

function routeLevel(props) {
  const raw = props?.Route_leve ?? props?.routelevel ?? props?.ROUTELEVEL
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return 2
  return n > 3 ? 3 : n
}

function flattenGeometry(feature) {
  const g = feature.geometry
  if (!g) return []
  if (g.type === 'LineString') return [g.coordinates]
  if (g.type === 'MultiLineString') return g.coordinates
  return []
}

function cleanNetwork(features) {
  const lines = []
  for (const f of features) {
    const level = routeLevel(f.properties)
    for (const coords of flattenGeometry(f)) {
      if (!coords || coords.length < 2) continue
      lines.push({ level, coords: coords.map((c) => [c[0], c[1]]) })
    }
  }

  snapAllVertices(lines, VERTEX_SNAP_METERS)
  weldEndpoints(lines, ENDPOINT_SNAP_METERS)
  snapTJunctions(lines, T_SNAP_METERS, T_EXTEND_METERS)
  snapTJunctions(lines, T_SNAP_METERS, T_EXTEND_METERS)
  splitAtCrossings(lines)
  weldEndpoints(lines, VERTEX_SNAP_METERS)

  let cleaned = dropTiny(lines)
  cleaned = dropParallelDuplicates(cleaned)
  cleaned = mergeDegree2(cleaned)

  const freeze = junctionKeys(cleaned)
  for (const l of cleaned) l.coords = roundCorners(l.coords, freeze)
  return toFeatures(cleaned)
}

const sourceDir =
  process.argv[2] || path.join(process.env.USERPROFILE || process.env.HOME || '', 'Documents')
const outDir = path.join(process.cwd(), 'public', 'data')

async function readShapefile(basename) {
  const shp = path.join(sourceDir, `${basename}.shp`)
  const dbf = path.join(sourceDir, `${basename}.dbf`)
  if (!fs.existsSync(shp)) throw new Error(`Shapefile not found: ${shp}`)
  return shapefile.read(shp, fs.existsSync(dbf) ? dbf : undefined, { encoding: 'utf-8' })
}

function writeGeoJson(filename, features) {
  const out = path.join(outDir, filename)
  fs.writeFileSync(out, JSON.stringify({ type: 'FeatureCollection', features }))
  console.log(`${features.length} features → ${path.relative(process.cwd(), out)}`)
}

const routesBasename = fs.existsSync(path.join(sourceDir, 'newRoute.shp')) ? 'newRoute' : 'route0180'
console.log(`reading ${routesBasename}.shp from ${sourceDir}`)

const routes = await readShapefile(routesBasename)
const mergedRoutes = cleanNetwork(routes.features)
writeGeoJson('routes.geojson', mergedRoutes)

const nodes = await readShapefile('Node')
const nodeFeatures = nodes.features
  .filter((f) => f.geometry?.type === 'Point')
  .map((f) => ({
    type: 'Feature',
    properties: {
      id: f.properties?.id ?? null,
      name: f.properties?.Name ?? f.properties?.name ?? null,
    },
    geometry: f.geometry,
  }))
writeGeoJson('route-nodes.geojson', snapNodesToRoutes(nodeFeatures, mergedRoutes))
