/**
 * Converts the historical route shapefiles into the two GeoJSON files the
 * Find Site map's route overlay reads (see lib/map-layers.ts):
 *
 *   route0180.shp  → public/data/routes.geojson       (LineString, `routelevel` 1–3)
 *   Node.shp       → public/data/route-nodes.geojson  (Point, Chinese `name`)
 *
 * Both .dbf files store their attribute text as UTF-8 (route0180.cpg says so;
 * Node ships no .cpg but is encoded the same way), which is *not* the DBF
 * default — passing the encoding explicitly is what keeps the node names from
 * coming out as mojibake.
 *
 *   node scripts/convert-routes-shapefile.mjs [sourceDir]
 *
 * sourceDir defaults to the user's Documents folder.
 */
import fs from 'fs'
import path from 'path'
import * as shapefile from 'shapefile'

/**
 * The routes are digitised as many short segments whose shared junctions were
 * never snapped together — abutting endpoints sit 200–800 m apart. Left as-is
 * every junction shows a stub or a gap once the lines are drawn with a casing.
 * Endpoints closer than this are treated as the same junction and welded; the
 * next-nearest neighbours jump to several km, and 800 m is under half a pixel
 * at the zoom levels this overlay is read at.
 */
const SNAP_METERS = 800

const metres = (a, b) =>
  Math.hypot((a[0] - b[0]) * Math.cos((a[1] * Math.PI) / 180), a[1] - b[1]) * 111320

/** Welds near-coincident endpoints, then concatenates same-level segments that
 *  meet at a welded junction so each run of route draws as one polyline. */
function weldAndMerge(features) {
  const lines = features.map((f) => ({
    level: f.properties.routelevel,
    coords: f.geometry.coordinates.map((c) => [c[0], c[1]]),
  }))

  // Weld: union endpoints that fall within tolerance of each other, then move
  // every member of a cluster onto its centroid.
  const ends = lines.flatMap((l, i) => [
    { i, at: 0 },
    { i, at: l.coords.length - 1 },
  ])
  const parent = ends.map((_, i) => i)
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let a = 0; a < ends.length; a++) {
    for (let b = a + 1; b < ends.length; b++) {
      if (ends[a].i === ends[b].i) continue
      const pa = lines[ends[a].i].coords[ends[a].at]
      const pb = lines[ends[b].i].coords[ends[b].at]
      if (metres(pa, pb) <= SNAP_METERS) parent[find(a)] = find(b)
    }
  }
  const clusters = new Map()
  ends.forEach((e, i) => {
    const root = find(i)
    if (!clusters.has(root)) clusters.set(root, [])
    clusters.get(root).push(e)
  })
  for (const members of clusters.values()) {
    if (members.length < 2) continue
    const pts = members.map((m) => lines[m.i].coords[m.at])
    const centroid = [
      pts.reduce((s, p) => s + p[0], 0) / pts.length,
      pts.reduce((s, p) => s + p[1], 0) / pts.length,
    ]
    members.forEach((m) => {
      lines[m.i].coords[m.at] = centroid
    })
  }

  // Merge: chain same-level segments through junctions where exactly two of
  // them meet. Anything busier stays split — a fork has no single continuation.
  const key = (p) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`
  const merged = []
  for (const level of [...new Set(lines.map((l) => l.level))]) {
    const group = lines.filter((l) => l.level === level)
    const degree = new Map()
    for (const l of group) {
      for (const p of [l.coords[0], l.coords[l.coords.length - 1]]) {
        degree.set(key(p), (degree.get(key(p)) ?? 0) + 1)
      }
    }
    const used = new Set()
    const endpointIndex = new Map()
    group.forEach((l, i) => {
      for (const p of [l.coords[0], l.coords[l.coords.length - 1]]) {
        if (!endpointIndex.has(key(p))) endpointIndex.set(key(p), [])
        endpointIndex.get(key(p)).push(i)
      }
    })

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
      const coords = [...l.coords]
      extend(coords, true)
      extend(coords, false)
      merged.push({
        type: 'Feature',
        properties: { routelevel: level },
        geometry: { type: 'LineString', coordinates: coords },
      })
    })
  }
  return merged
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

const routes = await readShapefile('route0180')
writeGeoJson(
  'routes.geojson',
  weldAndMerge(
    routes.features
      .filter((f) => f.geometry?.type === 'LineString')
      .map((f) => ({
        type: 'Feature',
        properties: { routelevel: Number(f.properties?.routelevel) || 2 },
        geometry: f.geometry,
      }))
  )
)

const nodes = await readShapefile('Node')
writeGeoJson(
  'route-nodes.geojson',
  nodes.features
    .filter((f) => f.geometry?.type === 'Point')
    .map((f) => ({
      type: 'Feature',
      properties: {
        id: f.properties?.id ?? null,
        name: f.properties?.Name ?? f.properties?.name ?? null,
      },
      geometry: f.geometry,
    }))
)
