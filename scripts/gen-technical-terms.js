// Run: node scripts/gen-technical-terms.js
//
// Scans the coin_types and sites tables for every distinct Chinese technical
// term (major/minor type, inscription, mint, state, site type, period) and
// writes technical-terms.csv listing, for each term, either its existing
// English translation (already in the database) or a proposed one — from the
// small built-in glossary for the five top-level coin categories, falling
// back to a pinyin romanization (via pinyin-pro, matching how this project's
// existing mint/place translations are already romanized, e.g. 邯郸 -> Handan).
// Proposed rows are explicitly marked so they can be reviewed before use.
const fs = require('fs')
const path = require('path')
const { pinyin } = require('pinyin-pro')

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const content = fs.readFileSync(envPath, 'utf8')
  const urlMatch = content.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)
  const keyMatch = content.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)
  if (!urlMatch || !keyMatch) {
    throw new Error('Could not find NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
  }
  return { url: urlMatch[1].trim(), key: keyMatch[1].trim() }
}

// Same glossary already duplicated across the app's map components
// (CoinFilterMap.tsx, CoinMap.tsx, CoinTypeHeatmapMap.tsx) for the five
// top-level coin categories.
const GLOSSARY = {
  布币: 'Spade Coin',
  刀币: 'Knife-Shaped Coin',
  圜钱: 'Round Coin',
  蚁鼻钱: 'Cowrie Coin',
  金版: 'Gold Plate',
}

function proposeTranslation(zh) {
  if (GLOSSARY[zh]) return { text: GLOSSARY[zh], source: 'glossary' }
  const romanized = pinyin(zh, { toneType: 'none' }).replace(/\s+/g, '')
  const capitalized = romanized.charAt(0).toUpperCase() + romanized.slice(1)
  return { text: capitalized, source: 'pinyin' }
}

async function fetchTable(url, key, table, select) {
  const res = await fetch(`${url}/rest/v1/${table}?select=${encodeURIComponent(select)}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) throw new Error(`Failed to fetch ${table}: ${res.status} ${await res.text()}`)
  return res.json()
}

function addTerm(map, category, zh, en) {
  if (!zh) return
  const zhTrim = zh.trim()
  if (!zhTrim) return
  const key = `${category}::${zhTrim}`
  const existing = map.get(key)
  if (!existing) {
    map.set(key, { category, zh: zhTrim, existing: en ? en.trim() : null })
  } else if (en && !existing.existing) {
    existing.existing = en.trim()
  }
}

function csvEscape(value) {
  const str = String(value ?? '')
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

const CATEGORY_ORDER = ['Major Type', 'Minor Type', 'Inscription', 'Mint', 'State', 'Site Type', 'Period']

async function main() {
  const { url, key } = loadEnv()

  const [coinTypes, sites] = await Promise.all([
    fetchTable(
      url,
      key,
      'coin_types',
      'major_type_zh,major_type_en,minor_type_zh,minor_type_en,inscription,inscription_en,mint_zh,mint_en,state_zh,state_en'
    ),
    fetchTable(url, key, 'sites', 'site_type_zh,site_type_en,period_zh,period_en'),
  ])

  const terms = new Map()
  coinTypes.forEach((c) => {
    addTerm(terms, 'Major Type', c.major_type_zh, c.major_type_en)
    addTerm(terms, 'Minor Type', c.minor_type_zh, c.minor_type_en)
    addTerm(terms, 'Inscription', c.inscription, c.inscription_en)
    addTerm(terms, 'Mint', c.mint_zh, c.mint_en)
    addTerm(terms, 'State', c.state_zh, c.state_en)
  })
  sites.forEach((s) => {
    addTerm(terms, 'Site Type', s.site_type_zh, s.site_type_en)
    addTerm(terms, 'Period', s.period_zh, s.period_en)
  })

  const rows = [...terms.values()].sort((a, b) => {
    const catDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    if (catDiff !== 0) return catDiff
    return a.zh.localeCompare(b.zh, 'zh-Hans-CN')
  })

  const header = ['Category', 'Chinese Term', 'Translation', 'Status', 'Source']
  const lines = [header.map(csvEscape).join(',')]

  let existingCount = 0
  let proposedCount = 0

  rows.forEach((row) => {
    if (row.existing) {
      existingCount++
      lines.push([row.category, row.zh, row.existing, 'existing', 'database'].map(csvEscape).join(','))
    } else {
      proposedCount++
      const { text, source } = proposeTranslation(row.zh)
      lines.push([row.category, row.zh, text, 'proposed', source].map(csvEscape).join(','))
    }
  })

  const outPath = path.join(__dirname, '..', 'technical-terms.csv')
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8')

  console.log(`Wrote ${rows.length} terms to ${outPath}`)
  console.log(`  ${existingCount} existing translations (from the database)`)
  console.log(`  ${proposedCount} proposed translations (glossary or pinyin fallback — review before use)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
