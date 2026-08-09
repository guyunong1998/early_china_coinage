import { pinyin } from 'pinyin-pro'

function titleCaseWords(input: string) {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export function toEnglishName(zh: string | null | undefined, existingEn: string | null | undefined) {
  const trimmedEn = existingEn?.trim()
  if (trimmedEn) return trimmedEn

  const trimmedZh = zh?.trim()
  if (!trimmedZh) return ''

  // Hanyu Pinyin fallback (tone-less)
  const py = pinyin(trimmedZh, { toneType: 'none', type: 'array' }).join(' ')
  return titleCaseWords(py)
}

