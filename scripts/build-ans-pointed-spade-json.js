/**
 * Converts ANS_Pointed_foot_spade.xlsx into public/data/ans-pointed-spade.json.
 *
 *   node scripts/build-ans-pointed-spade-json.js "path/to/ANS_Pointed_foot_spade.xlsx"
 */
const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const input =
  process.argv[2] ||
  path.join(process.env.USERPROFILE || '', 'Documents', '数据库表格', 'ANS_Pointed_foot_spade.xlsx')
const output = path.join(__dirname, '..', 'public', 'data', 'ans-pointed-spade.json')

const wb = XLSX.readFile(input)
const sheet = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

const records = rows
  .map((row) => {
    const inscription = String(row.Inscription ?? row.inscription ?? '').trim()
    if (!inscription) return null
    const catalog = row.Numer ?? row.catalog_number ?? row['Catalog Number']
    return {
      catalog_number: catalog != null && String(catalog).trim() ? String(catalog).trim() : null,
      inscription,
    }
  })
  .filter(Boolean)

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, JSON.stringify(records))
console.log('Wrote', records.length, 'pointed-foot spade records to', output)
