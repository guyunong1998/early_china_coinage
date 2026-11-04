/**
 * One-off data-prep script: clips the Natural Earth 1:10m rivers dataset to
 * only the segments that fall within a generously buffered version of
 * China's national boundary (BUFFER_KM below), then splits into "major"
 * (scalerank 0-3) and "minor" (scalerank 4-9) tiers.
 *
 * The buffer is deliberate -- clipping tight to the exact border reads as an
 * odd hard edge on a historical/archaeological map where the political
 * boundary isn't the point (rivers like the Amur/Heilong Jiang, Mekong/
 * Lancang, or Red River/Yuan Jiang should still trail off into Russia,
 * Southeast Asia, etc. rather than snapping off exactly at the modern
 * border), so this keeps a wide margin of cross-border river beyond it.
 *
 * Not part of the app build — run manually and commit the resulting files in
 * public/data/. Requires @turf/turf as a temporary devDependency.
 */
const fs = require('fs')
const turf = require('@turf/turf')

const BUFFER_KM = 800

const riversRaw = JSON.parse(fs.readFileSync('temp_rivers_10m.json', 'utf8'))
const chinaRaw = JSON.parse(fs.readFileSync('temp_china_boundary.json', 'utf8'))
const chinaFeature = turf.buffer(chinaRaw.features[0], BUFFER_KM, { units: 'kilometers' })

function round(coords) {
  if (typeof coords[0] === 'number') {
    return [Math.round(coords[0] * 10000) / 10000, Math.round(coords[1] * 10000) / 10000]
  }
  return coords.map(round)
}

function clipLineToChina(lineCoords, properties) {
  const line = turf.lineString(lineCoords)

  let segments
  try {
    const split = turf.lineSplit(line, chinaFeature)
    segments = split.features.length > 0 ? split.features.map((f) => f.geometry.coordinates) : [lineCoords]
  } catch {
    segments = [lineCoords]
  }

  const kept = []
  segments.forEach((seg) => {
    if (seg.length < 2) return
    // Use the midpoint of the segment to decide inside/outside — segments are
    // produced by splitting exactly at the boundary, so they don't straddle it.
    const midIdx = Math.floor(seg.length / 2)
    const midPoint = turf.point(seg[midIdx])
    if (turf.booleanPointInPolygon(midPoint, chinaFeature)) {
      kept.push(seg)
    }
  })

  return kept.map((seg) => ({
    type: 'Feature',
    properties,
    geometry: { type: 'LineString', coordinates: round(seg) },
  }))
}

function processFeatures(features) {
  const out = []
  features.forEach((f) => {
    const properties = { scalerank: f.properties.scalerank, name: f.properties.name || f.properties.name_en || null }
    const lines = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates]
    lines.forEach((lineCoords) => {
      if (lineCoords.length < 2) return
      out.push(...clipLineToChina(lineCoords, properties))
    })
  })
  return out
}

// Pre-filter with a generous bbox first so we don't run expensive turf ops on
// the whole planet's worth of rivers.
function bboxOfCoords(geom) {
  let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90
  function walk(coords) {
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    } else coords.forEach(walk)
  }
  walk(geom.coordinates)
  return [minLng, minLat, maxLng, maxLat]
}
// Padded well past China's own bbox by roughly BUFFER_KM (~7-8° of
// latitude) so this rough pre-filter doesn't exclude anything the actual
// buffered-polygon clip below would otherwise keep.
function roughlyNearChina(f) {
  const [minLng, minLat, maxLng, maxLat] = bboxOfCoords(f.geometry)
  return !(maxLng < 62 || minLng > 146 || maxLat < 5 || minLat > 64)
}

const candidates = riversRaw.features.filter(roughlyNearChina)
console.log('candidate features near China bbox:', candidates.length)

const major = processFeatures(candidates.filter((f) => f.properties.scalerank <= 3))
const minor = processFeatures(candidates.filter((f) => f.properties.scalerank >= 4))

fs.writeFileSync(
  'public/data/rivers-major.geojson',
  JSON.stringify({ type: 'FeatureCollection', features: major })
)
fs.writeFileSync(
  'public/data/rivers-minor.geojson',
  JSON.stringify({ type: 'FeatureCollection', features: minor })
)

console.log('major segments:', major.length, 'bytes:', fs.statSync('public/data/rivers-major.geojson').size)
console.log('minor segments:', minor.length, 'bytes:', fs.statSync('public/data/rivers-minor.geojson').size)
