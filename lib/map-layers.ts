/**
 * Shared tile layer definitions for all Leaflet maps.
 */
import { PLACE_LABELS } from '@/lib/place-labels'

type LeafletNS = typeof import('leaflet')

/**
 * River network (Natural Earth 1:10m, ranked by relative importance).
 * Line geometry is pre-clipped (see scripts/clip-rivers-to-china.js) to the
 * segments that fall within a generously buffered version of China's
 * national boundary (800km) — cross-border rivers like the Mekong/Lancang,
 * Amur/Heilong Jiang, or Red River/Yuan Jiang trail off well past the
 * modern border instead of snapping off exactly at it; only rivers entirely
 * far outside that buffer (e.g. Ganges, Krishna) are dropped.
 * "Major" = scalerank 0–3 (trunk rivers, e.g. Yangtze/Chang Jiang, Yellow
 * River/Huang, Mekong/Lancang). "Minor" = scalerank 4–9, i.e. everything below
 * the trunk tier. This is wider than a naive "4–5" cut: at global 1:10m scale,
 * rivers that are historically central to early Chinese coinage — Wei He
 * (rank 8), Fen He (rank 9), Zhang He (rank 8), Jing He (rank 8), Hai He/
 * Sanggan He/Yongding He (rank 7) — rank far below 5 simply because Natural
 * Earth ranks by global prominence, not regional/historical significance.
 * Both tiers are loaded lazily from static GeoJSON files so this works with
 * static export.
 */
type RiverProps = { scalerank?: number; name?: string | null }

// Matches the CAWM basemap's own ocean/water fill color (sampled from its
// tiles: rgb(97,163,224)) so rivers read as "more of the same water" laid
// over that basemap rather than an unrelated blue.
const RIVER_COLOR = '#61a3e0'

// Base weights below are tuned to look right around REFERENCE_ZOOM (a
// typical "looking at one region" zoom level, e.g. the sites overview map).
// Leaflet vector weights are constant screen pixels regardless of zoom, so
// without this a river covers vastly more ground at a zoomed-out world view
// than at REFERENCE_ZOOM while staying the same thickness on screen -- it
// reads as far too bold/prominent zoomed out, and a bit thin zoomed in. This
// scales weight down for lower zooms and up (mildly, capped) for higher
// ones, so line thickness stays roughly proportionate to what's on screen.
const REFERENCE_ZOOM = 6
const MIN_ZOOM_SCALE = 0.2
const MAX_ZOOM_SCALE = 1.4

function zoomScale(zoom: number) {
  const factor = Math.pow(2, (zoom - REFERENCE_ZOOM) / 3)
  return Math.min(MAX_ZOOM_SCALE, Math.max(MIN_ZOOM_SCALE, factor))
}

function riverWeight(rank: number, zoom: number) {
  const base =
    rank <= 1 ? 3.2 : rank === 2 ? 2.6 : rank === 3 ? 2.0 : rank === 4 ? 2.0 : rank === 5 ? 1.7 : rank === 6 ? 1.4 : rank === 7 ? 1.2 : 1.0
  return base * zoomScale(zoom)
}

function riverHaloWeight(rank: number, zoom: number) {
  // Major rivers get a generously wide halo; minor/tributary lines get a
  // tighter one so they stay crisp instead of turning into a blurry blob.
  return riverWeight(rank, zoom) + (rank <= 3 ? 2.2 : 1.4) * zoomScale(zoom)
}

function buildRiverLayer(L: LeafletNS, map: import('leaflet').Map, url: string) {
  const group = L.layerGroup()

  fetch(url)
    .then((res) => res.json())
    .then((geojson) => {
      type RiverFeature = import('geojson').Feature<import('geojson').Geometry, RiverProps>

      // A soft halo drawn underneath, in the same water color as the river
      // itself (just a touch more transparent) rather than a stark white
      // outline, so it reads as a gentle glow instead of a cutout edge.
      const haloStyle = (feature?: RiverFeature) => {
        const rank = feature?.properties?.scalerank ?? 5
        return { color: RIVER_COLOR, weight: riverHaloWeight(rank, map.getZoom()), opacity: 0.0 }
      }

      const mainStyle = (feature?: RiverFeature) => {
        const rank = feature?.properties?.scalerank ?? 5
        return { color: RIVER_COLOR, weight: riverWeight(rank, map.getZoom()), opacity: 0.8 }
      }

      const haloLayer = L.geoJSON<RiverProps>(geojson, { style: haloStyle, interactive: false }).addTo(group)

      const mainLayer = L.geoJSON<RiverProps>(geojson, {
        style: mainStyle,
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.name
          if (name) layer.bindTooltip(name, { sticky: true, className: 'river-tooltip' })
        },
      }).addTo(group)

      // Re-derive both layers' weights whenever the zoom settles, rather
      // than continuously mid-gesture -- setStyle on a couple thousand
      // line features isn't free, and zoomend already fires once the user
      // stops scrolling/pinching.
      map.on('zoomend', () => {
        haloLayer.setStyle(haloStyle)
        mainLayer.setStyle(mainStyle)
      })
    })
    .catch(() => {
      // River overlay is a non-essential visual layer — fail silently.
    })

  return group
}

/**
 * Academia Sinica's scanned Tang-dynasty road atlas (唐代交通路線圖), served
 * as WMTS. It's published as **JPEG**, so every tile arrives as line work
 * baked onto an opaque white sheet — dropped straight into Leaflet it would
 * hide whatever basemap it sits on. These two constants drive `keyOutWhite`
 * below, which repaints that white as real alpha.
 *
 * The source is lossy, so "white" is never exactly 255/255/255: JPEG ringing
 * scatters faint speckle across the empty areas and smears a wide halo around
 * every stroke — worst around the atlas's dense blocks of place-name
 * characters, where un-keyed ringing pools into visible violet fog. Anything
 * below `INK_NOISE` is therefore dropped outright rather than faded; the floor
 * sits high enough to take that fog with it. `INK_SOLID` is where ink turns
 * fully opaque, set well below 255 so this atlas's thin, pale strokes read as
 * solid lines instead of ghosts.
 */
const WHITE_KEY_INK_NOISE = 40
const WHITE_KEY_INK_SOLID = 100

/** How far to push the ink's own hues past what the scan recorded. The atlas
 *  was drawn for print on white paper, so its reds and blues are muted enough
 *  to sink into satellite imagery; this is what makes them read as deliberate
 *  route colors over any basemap. */
const WHITE_KEY_SATURATION = 1.5

/** Rec. 709 luma — the grey a pixel is pulled away from when saturating. */
function luma(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Rewrites a tile in place so its white background becomes transparent and
 * its surviving ink reads boldly on any basemap.
 *
 * Ink strength is read off the *darkest* channel rather than luminance — the
 * atlas draws its route classes in saturated colors (red, blue, cyan), and a
 * bright cyan river has a high average luminance despite being solid ink, so
 * a luminance test would erase it.
 *
 * Each surviving pixel is then un-multiplied against white: the scan shows ink
 * already composited onto a white sheet, so dividing that blend back out
 * recovers the stroke's own color. Without it every line would keep the white
 * it was mixed with and wash out over a dark basemap.
 */
function keyOutWhite(pixels: Uint8ClampedArray) {
  for (let i = 0; i < pixels.length; i += 4) {
    const ink = 255 - Math.min(pixels[i], pixels[i + 1], pixels[i + 2])
    if (ink <= WHITE_KEY_INK_NOISE) {
      pixels[i + 3] = 0
      continue
    }
    const alpha = Math.min(
      1,
      (ink - WHITE_KEY_INK_NOISE) / (WHITE_KEY_INK_SOLID - WHITE_KEY_INK_NOISE)
    )
    const white = 255 * (1 - alpha)
    const r = (pixels[i] - white) / alpha
    const g = (pixels[i + 1] - white) / alpha
    const b = (pixels[i + 2] - white) / alpha
    const grey = luma(r, g, b)
    pixels[i] = grey + (r - grey) * WHITE_KEY_SATURATION
    pixels[i + 1] = grey + (g - grey) * WHITE_KEY_SATURATION
    pixels[i + 2] = grey + (b - grey) * WHITE_KEY_SATURATION
    pixels[i + 3] = alpha * 255
  }
}

/** Pale casing drawn under the keyed ink. Saturated line work on a light
 *  basemap contrasts on its own, but over satellite imagery it lands on
 *  mid-tone greens and browns of similar darkness and stops separating; a
 *  light outline restores that edge, and is simply invisible on the pale
 *  basemaps where it isn't needed. Kept narrow — the blur is clipped at each
 *  tile's border, so a wide one would print a faint seam grid. */
const WHITE_KEY_CASING = 'drop-shadow(0 0 1.2px rgba(255,255,255,0.95))'
const WHITE_KEY_CASING_PASSES = 2

/** Leaflet's `_abortLoading` drops any still-loading tile from an outgoing
 *  zoom level, testing `<img>.complete`. A canvas has no such property, so
 *  every canvas tile reads as "never finished" and gets thrown away mid-zoom,
 *  flickering the layer. Tracking it ourselves keeps the old level on screen
 *  until the new one is ready. */
type CanvasTile = HTMLCanvasElement & { complete: boolean }

/** Scratch canvas the keying happens on, shared by every tile: `putImageData`
 *  ignores the compositing state a filter needs, so the keyed result has to be
 *  built somewhere else and then *drawn* into the real tile. Reused rather than
 *  allocated per tile — a screenful is dozens of tiles, and each one's
 *  processing runs start to finish synchronously inside its own `onload`, so
 *  they can never overlap. */
let keyingScratch: HTMLCanvasElement | null = null

function scratchFor(width: number, height: number) {
  const canvas = keyingScratch ?? (keyingScratch = document.createElement('canvas'))
  canvas.width = width
  canvas.height = height
  return canvas
}

/**
 * A tile layer that keys the white out of every tile before it's shown, then
 * paints it back down over a pale casing (see `WHITE_KEY_CASING`).
 *
 * Reading pixels back out of a canvas taints it unless the image was fetched
 * cross-origin-clean, hence `crossOrigin`; the Academia Sinica host does send
 * `Access-Control-Allow-Origin: *`. If it ever stops doing so, `getImageData`
 * throws and the tile falls back to the raw image — an opaque white block, but
 * still the right map.
 */
function buildWhiteKeyedTileLayer(
  L: LeafletNS,
  url: string,
  options: import('leaflet').TileLayerOptions
) {
  const WhiteKeyed = L.TileLayer.extend({
    createTile(
      this: import('leaflet').TileLayer,
      coords: import('leaflet').Coords,
      done: import('leaflet').DoneCallback
    ) {
      const size = this.getTileSize()
      const tile = L.DomUtil.create('canvas') as CanvasTile
      tile.width = size.x
      tile.height = size.y
      tile.complete = false

      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.onload = () => {
        const ctx = tile.getContext('2d')
        if (ctx) {
          const scratch = scratchFor(tile.width, tile.height)
          const scratchCtx = scratch.getContext('2d', { willReadFrequently: true })
          try {
            if (!scratchCtx) throw new Error('no 2d context')
            scratchCtx.clearRect(0, 0, tile.width, tile.height)
            scratchCtx.drawImage(image, 0, 0, tile.width, tile.height)
            const data = scratchCtx.getImageData(0, 0, tile.width, tile.height)
            keyOutWhite(data.data)
            scratchCtx.putImageData(data, 0, 0)

            // Each casing pass draws the ink *and* its outline, so stacking
            // passes thickens the outline; the final unfiltered pass puts the
            // ink back on top crisp.
            for (let pass = 0; pass < WHITE_KEY_CASING_PASSES; pass++) {
              ctx.filter = WHITE_KEY_CASING
              ctx.drawImage(scratch, 0, 0)
            }
            ctx.filter = 'none'
            ctx.drawImage(scratch, 0, 0)
          } catch {
            // Tainted canvas or no context — fall back to the raw tile.
            ctx.filter = 'none'
            ctx.drawImage(image, 0, 0, tile.width, tile.height)
          }
        }
        tile.complete = true
        done(undefined, tile)
      }
      image.onerror = () => {
        tile.complete = true
        done(new Error(`Tile failed to load: ${image.src}`), tile)
      }
      image.src = this.getTileUrl(coords)

      return tile
    },
  })

  return new WhiteKeyed(url, options) as import('leaflet').TileLayer
}

/** The place-name overlay has to outrank every other tile layer, and unlike
 *  them it can't get there on its own: `L.control.layers` hands each layer it
 *  manages an auto-assigned z-index, but the label layer is deliberately not
 *  in that control (it follows the language toggle, not a checkbox), so it
 *  would default to none and sit *below* every numbered layer — including
 *  whichever basemap the user switches to. Any value above the handful the
 *  control assigns does the job. */
const LABEL_TILE_Z_INDEX = 300

/**
 * 唐代交通路線圖 — Academia Sinica's digitised Tang road network, as a
 * white-keyed overlay (see `buildWhiteKeyedTileLayer`). This is the map's route
 * reference: a scanned raster, so nothing on it is queryable and its
 * place-name captions are part of the image rather than a layer that could be
 * switched off, but it covers the whole empire at a level of detail no
 * vectorised subset here matches.
 *
 * Its tile pyramid stops at z11 — deeper requests come back as a blank
 * placeholder image rather than a 404, so Leaflet can't detect the ceiling on
 * its own and `maxNativeZoom` has to state it. `maxZoom` then hides the layer
 * entirely past z13: upscaling a raster two levels is a reasonable stretch,
 * but at street zoom it would blow single strokes up into blurred colour
 * bands wide enough to swallow a whole town, which reads as a rendering fault
 * rather than as a road. `bounds` comes from the service's declared extent —
 * outside it every tile is that same blank placeholder.
 */
function buildTangRoutesLayer(L: LeafletNS) {
  return buildWhiteKeyedTileLayer(
    L,
    'https://gis.sinica.edu.tw/ccts/file-exists.php?img=Tang_TrafficRoute-jpg-{z}-{x}-{y}',
    {
      attribution:
        '唐代交通路線圖 © <a href="https://gis.sinica.edu.tw/showwmts/index.php?s=ccts&l=Tang_TrafficRoute">中央研究院人社中心 GIS 專題中心</a>',
      bounds: L.latLngBounds([17.04, 68.139], [57.103, 145.66]),
      maxNativeZoom: 11,
      maxZoom: 13,
    }
  )
}

export function buildBaseLayers(L: LeafletNS) {
  // Ancient World Mappers' hillshaded terrain basemap — an alternative to
  // the default CyclOSM base layer (see the cyclosm tile layer below) for a
  // historical/archaeological atlas look. Its own tiles only go up to zoom
  // 11 (maxNativeZoom); maxZoom stays high so Leaflet just upscales the
  // last tile instead of leaving deep zooms blank.
  const cawm = L.tileLayer('https://cawm.lib.uiowa.edu/tiles/{z}/{x}/{y}.png', {
    attribution:
      'Basemap © <a href="https://cawm.lib.uiowa.edu">Consortium of Ancient World Mappers</a>',
    maxZoom: 19,
    maxNativeZoom: 11,
  })

  const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution:
        'Tiles © <a href="https://www.esri.com">Esri</a> — Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN',
      maxZoom: 19,
    }
  )

  // CyclOSM — a modern OpenStreetMap-derived basemap, and the default base
  // layer across the site (see each map component's `cyclosm.addTo(map)`).
  // The hillshaded terrain (cawm) and satellite layers above remain as
  // alternatives via the layer switcher on the dedicated Map Visualizations
  // pages.
  const cyclosm = L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
    attribution:
      'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.cyclosm.org">CyclOSM</a> hosted by <a href="https://openstreetmap.fr">OpenStreetMap France</a>',
    maxZoom: 20,
  })

  // Plain OpenStreetMap Carto — CyclOSM above is also OSM data, but its
  // cycling-oriented styling pushes roads and paths forward; this is the
  // standard rendering, for reading present-day place names and admin
  // boundaries straight.
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  })

  // Transparent English/romanized place-name overlay (Esri's reference
  // layer). Neither base layer (the Stamen terrain background nor the
  // satellite imagery) carries any place labels of its own, so one of these
  // two label layers is always the only source of text on the map — which
  // one is active follows the site's language toggle (see
  // `setLabelLayerForLang` below), not a manual checkbox.
  const labelsEn = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    { attribution: '', maxZoom: 19, opacity: 1, zIndex: LABEL_TILE_Z_INDEX }
  )

  // Chinese-script place-name overlay — the zh counterpart to Esri's English
  // layer above, but self-authored (see buildPlaceLabelsLayer) rather than a
  // third-party tile: every public AutoNavi/Amap annotation tile bundles a
  // full road network with the labels (no way to get just the text), and
  // Esri/Stadia/CartoDB's own label tiles only ever render English/pinyin
  // regardless of language. A small hand-picked city list sidesteps that —
  // same plain "dot + text" look as the English layer, no road clutter.
  const labelsZh = buildPlaceLabelsLayer(L)

  // Holder for whichever of the two is currently in use, so callers have one
  // stable layer to add, remove, or hand to a layer control without caring
  // which language is active — swapping the contents (setLabelLayerForLang)
  // then never disturbs that outer on/off state.
  const placeLabels = L.layerGroup()

  return { cawm, satellite, cyclosm, osm, labelsEn, labelsZh, placeLabels }
}

export type BaseLayers = ReturnType<typeof buildBaseLayers>

/**
 * Builds the Chinese place-label layer from the static list in
 * lib/place-labels.ts — a small dot plus a permanent text tooltip per city,
 * styled by `.place-label-tooltip` in app/maps.css to read as plain text
 * (no bubble/arrow chrome) rather than a normal Leaflet tooltip popup.
 */
function buildPlaceLabelsLayer(L: LeafletNS) {
  const group = L.layerGroup()
  PLACE_LABELS.forEach(({ lat, lng, zh }) => {
    L.circleMarker([lat, lng], {
      radius: 2.5,
      color: '#333',
      weight: 1,
      fillColor: '#333',
      fillOpacity: 1,
      interactive: false,
    })
      .bindTooltip(zh, {
        permanent: true,
        direction: 'right',
        offset: [4, 0],
        className: 'place-label-tooltip',
        interactive: false,
      })
      .addTo(group)
  })
  return group
}

/** Anything a label layer can live in. `Map` and `LayerGroup` both expose this
 *  much of Leaflet's container API, which is all the swap below needs. */
type LabelHost = {
  hasLayer(layer: import('leaflet').Layer): boolean
  addLayer(layer: import('leaflet').Layer): unknown
  removeLayer(layer: import('leaflet').Layer): unknown
}

/**
 * Shows the label layer matching `lang` inside `host` and hides the other one
 * — the single place this decision is made, called both right after the base
 * layers are built (initial state) and again whenever the language toggle
 * changes (see each map component's `[lang]`-keyed effect).
 *
 * Pass the map itself for the maps where labels are simply always on. Pass
 * `placeLabels` where the user can turn them off (the Map Visualizations layer
 * control): confining the swap to that group means a language change can't
 * quietly switch the labels back on behind the user's checkbox.
 */
export function setLabelLayerForLang(
  host: LabelHost,
  labelsEn: import('leaflet').Layer,
  labelsZh: import('leaflet').Layer,
  lang: 'en' | 'zh'
) {
  const show = lang === 'zh' ? labelsZh : labelsEn
  const hide = lang === 'zh' ? labelsEn : labelsZh
  if (host.hasLayer(hide)) host.removeLayer(hide)
  if (!host.hasLayer(show)) host.addLayer(show)
}

/**
 * Full interactive chrome, as a single control: the basemap switcher over the
 * toggleable overlays, so everything the user can turn on or off lives in one
 * box. Reserved for the dedicated Map Visualizations pages (desktop only — see
 * `addStaticMajorRivers` below for every other map, and for all maps on mobile
 * screens).
 *
 * Place names are one of those overlays here. Elsewhere they're fixed
 * furniture, but this is the one map that stacks a captioned historical atlas
 * under them, and two sets of names competing over the same towns is worth
 * being able to switch off; the language toggle still picks *which* set (see
 * `setLabelLayerForLang`).
 *
 * The river tiers are two independent checkboxes rather than the
 * Off/Major/Minor/All radio group they replaced: unticking both is "off",
 * ticking both is "all", so no combination was lost by folding them in here.
 */
export function addLayerControl(
  L: LeafletNS,
  map: import('leaflet').Map,
  layers: BaseLayers,
  options?: { collapsed?: boolean; position?: import('leaflet').ControlPosition }
) {
  const { cawm, satellite, cyclosm, osm, placeLabels } = layers
  const position = options?.position ?? 'topright'

  const majorRivers = buildRiverLayer(L, map, '/data/rivers-major.geojson').addTo(map)
  const minorRivers = buildRiverLayer(L, map, '/data/rivers-minor.geojson')
  const tangRoutes = buildTangRoutesLayer(L).addTo(map)

  L.control
    .layers(
      // CyclOSM (already the active base layer when this control is built —
      // see MapVisCanvas's init effect) stays first/checked.
      { CyclOSM: cyclosm, 'Ancient World Map': cawm, Satellite: satellite, OpenStreetMap: osm },
      {
        'Major rivers': majorRivers,
        'Minor rivers': minorRivers,
        'Tang routes (Academia Sinica)': tangRoutes,
        'Place names': placeLabels,
      },
      { collapsed: options?.collapsed ?? false, position }
    )
    .addTo(map)
}

/**
 * Every map outside the dedicated Map Visualizations pages (and every map on
 * mobile screens, including those pages): no layer control at all — just the
 * major river network, always on, as a fixed reference layer with no way to
 * toggle it off.
 */
export function addStaticMajorRivers(L: LeafletNS, map: import('leaflet').Map) {
  buildRiverLayer(L, map, '/data/rivers-major.geojson').addTo(map)
}

/** The Tang road atlas as a fixed layer, for the same no-controls maps that get
 *  `addStaticMajorRivers` — otherwise routes would vanish entirely below the
 *  768px breakpoint, where the layer control isn't built. */
export function addStaticTangRoutes(L: LeafletNS, map: import('leaflet').Map) {
  buildTangRoutesLayer(L).addTo(map)
}
