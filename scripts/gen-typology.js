/**
 * Regenerate lib/typology-data.ts from Typology.xlsx
 *
 *   node scripts/gen-typology.js [path/to/Typology.xlsx]
 */
const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')

const input =
  process.argv[2] ||
  path.join(process.env.USERPROFILE || '', 'Documents', 'Typology.xlsx')

const wb = XLSX.readFile(input)

// --- 国别判断: Type → [{inscription, mint, state}] ---
const attrSheet = wb.Sheets['国别判断']
const attrRows = XLSX.utils.sheet_to_json(attrSheet, { defval: '' })
const byType = {}
const allMints = []
const mintSeen = new Set()

attrRows.forEach((r) => {
  const type_zh = (r.Type || r.type_zh || '').trim()
  if (!type_zh) return

  const insc_zh = (r.Inscription || r.inscription_zh || '').trim() || null
  const insc_en = (r['Inscription-English'] || r.inscription_en || '').trim() || null
  const mint_zh = (r.Mint || r.mint_zh || '').trim() || null
  const mint_en = (r['Mint-English'] || r.mint_en || '').trim() || null
  const state_zh = (r.State || r.state_zh || '').trim() || null
  const state_en = (r['English translation'] || r.state_en || '').trim() || null

  if (!byType[type_zh]) byType[type_zh] = []
  byType[type_zh].push({
    inscription_zh: insc_zh,
    inscription_en: insc_en,
    mint_zh,
    mint_en: mint_en || null,
    state_zh,
    state_en: state_en || null,
  })

  if (mint_zh && !mintSeen.has(mint_zh)) {
    mintSeen.add(mint_zh)
    allMints.push({
      mint_zh,
      mint_en: mint_en || null,
      state_zh,
      state_en: state_en || null,
    })
  }
})

const L1_ZH = {
  'Spade Coin': '布币',
  'Knife-Shaped Coin': '刀币',
  'Round Coin': '圜钱',
  'Ant-nose Coin': '蚁鼻钱',
  'Gold Plate': '金版',
}

// --- Build Level 1–4 hierarchy from 钱币分类术语 ---
function split(s) {
  if (!s) return { en: '', zh: '' }
  const trimmed = String(s).trim()
  const m = trimmed.match(/^([A-Za-z][A-Za-z0-9\-' ]*)\s+([\u4e00-\u9fff].*)$/)
  if (m) return { en: m[1].trim(), zh: m[2].trim() }
  const m2 = trimmed.match(/^([A-Za-z][A-Za-z0-9\-' ]*)\s*([\u4e00-\u9fff].*)$/)
  if (m2 && m2[2]) return { en: m2[1].trim(), zh: m2[2].trim() }
  if (/[\u4e00-\u9fff]/.test(trimmed)) return { en: '', zh: trimmed }
  return { en: trimmed, zh: '' }
}

const termSheet = wb.Sheets['钱币分类术语']
const termRows = XLSX.utils.sheet_to_json(termSheet, { defval: '' })
const typology = []
let curL1 = null
let curL2 = null
let curL3 = null

termRows.forEach((row) => {
  const l1raw = row['Level 1']
  const l2raw = row['Level 2']
  const l3raw = row['Level 3']
  const l4raw = row['Level 4']

  if (l1raw) {
    const p = split(l1raw)
    curL1 = {
      label_en: p.en,
      label_zh: p.zh || L1_ZH[p.en] || '',
      children: [],
    }
    typology.push(curL1)
    curL2 = null
    curL3 = null
  }
  if (l2raw && curL1) {
    const p = split(l2raw)
    curL2 = { label_en: p.en, label_zh: p.zh, children: [] }
    curL1.children.push(curL2)
    curL3 = null
  }
  if (l3raw && curL2) {
    const p = split(l3raw)
    const type_key = p.zh || p.en
    curL3 = {
      label_en: p.en,
      label_zh: p.zh,
      type_key,
      entries: byType[type_key] || [],
      children: [],
    }
    curL2.children.push(curL3)
  }
  if (l4raw && curL3) {
    const p = split(l4raw)
    curL3.children.push({
      label_en: p.en,
      label_zh: p.zh,
      filter_key: p.zh || p.en,
    })
  }
})

// L2 types with no L3 children (e.g. 尖首刀, 圜钱) carry entries directly
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

export type TypologyL4 = {
  label_en: string
  label_zh: string
  filter_key: string
}

export type TypologyL3 = {
  label_en: string
  label_zh: string
  type_key: string
  entries: TypologyLeaf[]
  children: TypologyL4[]
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

fs.writeFileSync(path.join(__dirname, '..', 'lib', 'typology-data.ts'), out)
console.log('Written lib/typology-data.ts from', input)
console.log('L1 types:', typology.map((x) => x.label_zh || x.label_en))
console.log('Mints:', allMints.length)
