/**
 * Re-applies snapNodesToRoutes (see route-node-snap.mjs) to the already
 * generated public/data/routes.geojson + route-nodes.geojson, in place —
 * for fixing up existing output, or after the Node shapefile alone changes,
 * without needing the original .shp files that convert-routes-shapefile.mjs
 * requires.
 *
 *   node scripts/resnap-route-nodes.mjs
 */
import fs from 'fs'
import path from 'path'
import { snapNodesToRoutes } from './route-node-snap.mjs'

const dataDir = path.join(process.cwd(), 'public', 'data')
const routesPath = path.join(dataDir, 'routes.geojson')
const nodesPath = path.join(dataDir, 'route-nodes.geojson')

const routes = JSON.parse(fs.readFileSync(routesPath, 'utf-8'))
const nodes = JSON.parse(fs.readFileSync(nodesPath, 'utf-8'))

const snapped = snapNodesToRoutes(nodes.features, routes.features)
fs.writeFileSync(nodesPath, JSON.stringify({ ...nodes, features: snapped }))

const moved = snapped.filter((f, i) => f !== nodes.features[i]).length
console.log(`${moved}/${snapped.length} nodes snapped onto their nearest route → ${path.relative(process.cwd(), nodesPath)}`)
