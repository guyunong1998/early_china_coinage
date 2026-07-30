/**
 * A small hand-picked set of major cities/capitals (China's provincial
 * capitals plus a handful of neighboring countries' capitals, for
 * orientation beyond the border) used to build the map's place-name label
 * layer — see lib/map-layers.ts's `buildPlaceLabelsLayer`.
 *
 * This exists because there's no free, no-API-key tile source that renders
 * clean Chinese-script place names without also baking in a full road
 * network (every public AutoNavi/Amap annotation style bundles roads; Esri,
 * Stadia, and CartoDB's label tiles only render English/pinyin regardless of
 * language). Authoring a small static list sidesteps that entirely — same
 * minimal "dot + text" look as the English (Esri) label layer, in both
 * languages, with zero road/infrastructure clutter since nothing but these
 * points is ever drawn.
 */
export type PlaceLabel = {
  lat: number
  lng: number
  zh: string
  en: string
}

export const PLACE_LABELS: PlaceLabel[] = [
  { lat: 39.9042, lng: 116.4074, zh: '北京', en: 'Beijing' },
  { lat: 39.0842, lng: 117.2009, zh: '天津', en: 'Tianjin' },
  { lat: 38.0428, lng: 114.5149, zh: '石家庄', en: 'Shijiazhuang' },
  { lat: 37.8706, lng: 112.5489, zh: '太原', en: 'Taiyuan' },
  { lat: 40.8414, lng: 111.7519, zh: '呼和浩特', en: 'Hohhot' },
  { lat: 41.8057, lng: 123.4315, zh: '沈阳', en: 'Shenyang' },
  { lat: 43.8171, lng: 125.3235, zh: '长春', en: 'Changchun' },
  { lat: 45.8038, lng: 126.5350, zh: '哈尔滨', en: 'Harbin' },
  { lat: 31.2304, lng: 121.4737, zh: '上海', en: 'Shanghai' },
  { lat: 32.0603, lng: 118.7969, zh: '南京', en: 'Nanjing' },
  { lat: 30.2741, lng: 120.1551, zh: '杭州', en: 'Hangzhou' },
  { lat: 31.8206, lng: 117.2272, zh: '合肥', en: 'Hefei' },
  { lat: 26.0745, lng: 119.2965, zh: '福州', en: 'Fuzhou' },
  { lat: 28.6820, lng: 115.8579, zh: '南昌', en: 'Nanchang' },
  { lat: 36.6512, lng: 117.1201, zh: '济南', en: 'Jinan' },
  { lat: 34.7466, lng: 113.6254, zh: '郑州', en: 'Zhengzhou' },
  { lat: 30.5928, lng: 114.3055, zh: '武汉', en: 'Wuhan' },
  { lat: 28.2282, lng: 112.9388, zh: '长沙', en: 'Changsha' },
  { lat: 23.1291, lng: 113.2644, zh: '广州', en: 'Guangzhou' },
  { lat: 22.8170, lng: 108.3665, zh: '南宁', en: 'Nanning' },
  { lat: 20.0444, lng: 110.1989, zh: '海口', en: 'Haikou' },
  { lat: 29.5630, lng: 106.5516, zh: '重庆', en: 'Chongqing' },
  { lat: 30.5728, lng: 104.0668, zh: '成都', en: 'Chengdu' },
  { lat: 26.6470, lng: 106.6302, zh: '贵阳', en: 'Guiyang' },
  { lat: 25.0389, lng: 102.7183, zh: '昆明', en: 'Kunming' },
  { lat: 29.6500, lng: 91.1000, zh: '拉萨', en: 'Lhasa' },
  { lat: 34.3416, lng: 108.9398, zh: '西安', en: "Xi'an" },
  { lat: 36.0611, lng: 103.8343, zh: '兰州', en: 'Lanzhou' },
  { lat: 36.6171, lng: 101.7782, zh: '西宁', en: 'Xining' },
  { lat: 38.4872, lng: 106.2309, zh: '银川', en: 'Yinchuan' },
  { lat: 43.8256, lng: 87.6168, zh: '乌鲁木齐', en: 'Urumqi' },
  { lat: 22.3193, lng: 114.1694, zh: '香港', en: 'Hong Kong' },
  { lat: 25.0330, lng: 121.5654, zh: '台北', en: 'Taipei' },
  { lat: 22.1987, lng: 113.5439, zh: '澳门', en: 'Macau' },
  { lat: 47.8864, lng: 106.9057, zh: '乌兰巴托', en: 'Ulaanbaatar' },
  { lat: 39.0392, lng: 125.7625, zh: '平壤', en: 'Pyongyang' },
  { lat: 37.5665, lng: 126.9780, zh: '首尔', en: 'Seoul' },
  { lat: 35.6762, lng: 139.6503, zh: '东京', en: 'Tokyo' },
  { lat: 21.0278, lng: 105.8342, zh: '河内', en: 'Hanoi' },
]
