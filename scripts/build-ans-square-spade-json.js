/**
 * Converts ANS_Spade_clean.csv (square-foot spades / 方足布) into
 * public/data/ans-square-spade.json. Re-run when the CSV is updated:
 *
 *   node scripts/build-ans-square-spade-json.js "path/to/ANS_Spade_clean.csv"
 */
const fs = require('fs')
const path = require('path')

const input =
  process.argv[2] ||
  path.join(process.env.USERPROFILE || '', 'Documents', '数据库表格', 'ANS_Spade_clean.csv')
const output = path.join(__dirname, '..', 'public', 'data', 'ans-square-spade.json')

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

const text = fs.readFileSync(input, 'utf8')
const lines = text.trim().split(/\r?\n/)
const header = parseCsvLine(lines[0])
const obIdx = header.indexOf('obverse_inscription')
const revIdx = header.indexOf('reverse_inscription')
const catIdx = header.indexOf('catalog_number')

if (obIdx < 0 || catIdx < 0) {
  console.error('Expected columns catalog_number and obverse_inscription')
  process.exit(1)
}

const records = []
for (let i = 1; i < lines.length; i++) {
  const cols = parseCsvLine(lines[i])
  if (cols.length < header.length) continue
  const obverse = cols[obIdx]?.trim()
  if (!obverse) continue
  records.push({
    catalog_number: cols[catIdx]?.trim() || null,
    obverse_inscription: obverse,
    reverse_inscription: revIdx >= 0 ? cols[revIdx]?.trim() || null : null,
  })
}

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify(records))
console.log('Wrote', records.length, 'records to', output)
