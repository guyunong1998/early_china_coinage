// Run: node scripts/gen-typology.js
const XLSX = require('xlsx')
const fs = require('fs')

const wb = XLSX.readFile('C:\\Users\\25589\\Documents\\数据库表格\\Dongbei\\Typology.xlsx')

// --- 国别判断: type_zh → [{inscription, mint, state}] ---
const attrRows = XLSX.utils.sheet_to_json(wb.Sheets['国别判断'], { header: 1 }).slice(1)
const byType = {}
attrRows.forEach((r) => {
  const [type_zh, insc_zh, insc_en, mint_zh, mint_en, state_zh, state_en] = r
  if (!type_zh) return
  if (!byType[type_zh]) byType[type_zh] = []
  byType[type_zh].push({
    inscription_zh: insc_zh || null,
    inscription_en: insc_en || null,
    mint_zh: mint_zh || null,
    mint_en: mint_en || null,
    state_zh: state_zh || null,
    state_en: state_en || null,
  })
})

// Unique mints
const allMints = []
const mintSeen = new Set()
attrRows.forEach((r) => {
  const [, , , mint_zh, mint_en, state_zh, state_en] = r
  if (mint_zh && !mintSeen.has(mint_zh)) {
    mintSeen.add(mint_zh)
    allMints.push({ mint_zh, mint_en: mint_en || null, state_zh: state_zh || null, state_en: state_en || null })
  }
})

// --- Build Level 1/2/3 hierarchy ---
function split(s) {
  if (!s) return { en: '', zh: '' }
  const m = s.match(/^([A-Za-z0-9\-' ]+)\s*(.*)$/)
  return m ? { en: m[1].trim(), zh: m[2].trim() } : { en: s, zh: '' }
}

const typRows = XLSX.utils.sheet_to_json(wb.Sheets['钱币分类术语'], { header: 1 }).slice(1)
const typology = []
let curL1 = null, curL2 = null

typRows.forEach((row) => {
  const [l1raw, l2raw, l3raw] = row
  if (l1raw) {
    const p = split(l1raw)
    curL1 = { label_en: p.en, label_zh: p.zh, children: [] }
    typology.push(curL1)
    curL2 = null
  }
  if (l2raw && curL1) {
    const p = split(l2raw)
    curL2 = { label_en: p.en, label_zh: p.zh, children: [] }
    curL1.children.push(curL2)
  }
  if (l3raw && curL2) {
    const p = split(l3raw)
    const type_key = p.zh || p.en
    curL2.children.push({ label_en: p.en, label_zh: p.zh, type_key, entries: byType[type_key] || [] })
  }
})

// Attach entries for L2 types that have no L3 children (e.g. direct knife types)
typology.forEach((l1) => {
  l1.children.forEach((l2) => {
    if (l2.children.length === 0) {
      const type_key = l2.label_zh || l2.label_en
      l2.type_key = type_key
      l2.entries = byType[type_key] || []
    }
  })
})

const header = `// AUTO-GENERATED from Typology.xlsx — do not edit manually
// Re-generate: node scripts/gen-typology.js

export type TypologyLeaf = {
  inscription_zh: string | null
  inscription_en: string | null
  mint_zh: string | null
  mint_en: string | null
  state_zh: string | null
  state_en: string | null
}

export type TypologyL3 = {
  label_en: string
  label_zh: string
  type_key: string
  entries: TypologyLeaf[]
}

export type TypologyL2 = {
  label_en: string
  label_zh: string
  type_key?: string
  entries?: TypologyLeaf[]
  children: TypologyL3[]
}

export type TypologyL1 = {
  label_en: string
  label_zh: string
  children: TypologyL2[]
}

export const TYPOLOGY: TypologyL1[] = `

const footer = `

export const ALL_MINTS: {
  mint_zh: string
  mint_en: string | null
  state_zh: string | null
  state_en: string | null
}[] = `

const out =
  header +
  JSON.stringify(typology, null, 2) +
  footer +
  JSON.stringify(allMints, null, 2) +
  '\n'

fs.writeFileSync('lib/typology-data.ts', out)
console.log('Written lib/typology-data.ts')
console.log('L1 types:', typology.map((x) => x.label_en))
console.log('Mints:', allMints.length)
