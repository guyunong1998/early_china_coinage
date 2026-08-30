import type { Source } from './types'

function trim(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function firstNonEmpty(...values: (string | null | undefined)[]): string {
  for (const value of values) {
    const t = trim(value)
    if (t) return t
  }
  return ''
}

function stripBooks(value: string): string {
  return value.replace(/[《》]/g, '').trim()
}

/** The first work in citation_zh — later `；`-separated works are other sources. */
function primaryCitationSegment(source: Source): string {
  const raw = trim(source.citation_zh) || trim(source.citation_en)
  if (!raw) return ''
  return raw.split(/[；;]/)[0]?.trim() ?? ''
}

/** Join Chinese bibliographic parts, dropping blanks so we never emit stray commas. */
export function joinCitationParts(parts: (string | null | undefined)[], sep = '，'): string {
  return parts.map((p) => trim(p)).filter(Boolean).join(sep)
}

export function wrapBookTitle(title: string | null | undefined): string {
  const t = trim(title)
  if (!t) return ''
  if (t.startsWith('《') && t.endsWith('》')) return t
  return `《${t.replace(/^《/, '').replace(/》$/, '')}》`
}

export function joinAuthors(source: Source): string {
  return [
    firstNonEmpty(source.author1_zh, source.author1_en),
    firstNonEmpty(source.author2_zh, source.author2_en),
    firstNonEmpty(source.author3_zh, source.author3_en),
  ]
    .filter(Boolean)
    .join('、')
}

function imprint(source: Source): string {
  const place = firstNonEmpty(source.place_zh, source.place_en)
  const publisher = firstNonEmpty(source.publication_zh, source.publication_en)
  if (place && publisher) return `${place}：${publisher}`
  return place || publisher
}

function withBian(editor: string): string {
  return /编$/.test(editor) ? editor : `${editor}编`
}

function yearWithNian(year: number | null | undefined): string {
  return year == null ? '' : `${year}年`
}

/** `MM-DD` / `YYYY-MM-DD` → 2021年10月29日. Leading zeros stripped. */
export function formatZhDate(date: string | null | undefined, year: number | null | undefined): string {
  const raw = trim(date)
  const ymd = raw.match(/^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})$/)
  if (ymd) {
    const y = ymd[1] ? Number(ymd[1]) : year
    const month = String(Number(ymd[2]))
    const day = String(Number(ymd[3]))
    return y != null ? `${y}年${month}月${day}日` : `${month}月${day}日`
  }
  const zh = raw.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (zh) return `${Number(zh[1])}年${Number(zh[2])}月${Number(zh[3])}日`
  if (raw && year != null) return `${year}年${raw}`
  if (raw) return raw
  return year != null ? `${year}年` : ''
}

function endsWithPunct(s: string): boolean {
  return /[。．.!?！？]$/.test(s)
}

function ensureAsciiPeriod(s: string): string {
  if (!s || endsWithPunct(s)) return s
  return `${s}.`
}

function ensureIdeographicPeriod(s: string): string {
  if (!s || endsWithPunct(s)) return s
  return `${s}。`
}

function extractUrl(source: Source): string {
  const direct = trim(source.url)
  if (direct) return direct.replace(/[。.,;；]+$/, '')
  const fromCitation = primaryCitationSegment(source).match(/https?:\/\/[^\s，。,;；]+/)?.[0]
  return fromCitation?.replace(/[。.,;；]+$/, '') ?? ''
}

function authorThenTitle(authors: string, title: string, colon = true): string {
  if (authors && title) return colon ? `${authors}：${title}` : joinCitationParts([authors, title])
  return authors || title
}

function parseLeadingAuthors(segment: string): string[] {
  const head = segment.match(/^([^：《\n]{1,80})[：:]《/) ?? segment.match(/^([^，《\n]{1,40})，/)
  if (!head) return []
  const raw = head[1]
    .replace(/[（(]推定[)）]/g, '')
    .replace(/(著|主编|编著|编)$/g, '')
    .trim()
  if (!raw || /https?:\/\//.test(raw)) return []
  return raw
    .split(/[、]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parsePageToken(segment: string): string {
  const numbered = segment.match(/第\s*(\d+\s*[-–—~至到]\s*\d+)\s*页/) ?? segment.match(/第\s*(\d+)\s*页/)
  if (numbered) return numbered[1].replace(/\s+/g, '').replace(/[–—至到]/g, '-')
  const trailing = segment.match(/[，,]\s*(\d+\s*[-–—]\s*\d+)\s*[。．.]?\s*$/) ?? segment.match(/[，,]\s*(\d+)\s*[。．.]?\s*$/)
  if (trailing) return trailing[1].replace(/\s+/g, '').replace(/[–—]/g, '-')
  return ''
}

function parseNewspaperName(segment: string): string {
  const wrapped = segment.match(/《([^》]*报[^》]*)》/)
  if (wrapped) return wrapped[1]
  const glued = segment.match(/([^，《》\s]{2,20}报)\d{4}年/)
  if (glued) return glued[1]
  const listed = segment.match(/[，,]\s*([^，《》\s]{2,20}报)\s*[，,]/)
  if (listed) return listed[1]
  return ''
}

function parseJournalVolume(segment: string, year: number | null): string {
  const issued = segment.match(/第\s*([0-9]+)\s*期/)
  if (issued) return `第${issued[1]}期`
  if (year != null) {
    const afterYear = segment.match(new RegExp(`${year}年([^，,]{1,12}[期辑])`))
    if (afterYear) return afterYear[1].startsWith('第') ? afterYear[1] : `第${afterYear[1]}`
  }
  return ''
}

/**
 * Fill empty bibliographic columns from the matching piece of citation_zh
 * (never the whole raw string). Used only to assemble the typed formats.
 */
function enrichSourceFields(source: Source): Source {
  const segment = primaryCitationSegment(source)
  const next: Source = { ...source }

  const names = parseLeadingAuthors(segment)
  if (names.length > 0) {
    if (!trim(next.author1_zh) && !trim(next.author1_en)) next.author1_zh = names[0] ?? null
    if (!trim(next.author2_zh) && !trim(next.author2_en) && names[1]) next.author2_zh = names[1]
    if (!trim(next.author3_zh) && !trim(next.author3_en) && names[2]) next.author3_zh = names[2]
  }

  if (!trim(next.page)) {
    const page = parsePageToken(segment)
    if (page) next.page = page
  }

  if (!trim(next.url)) {
    const url = extractUrl(next)
    if (url) next.url = url
  }

  const type = trim(next.type)
  if ((type === 'Newspaper' || !type) && !trim(next.publication_zh) && !trim(next.publication_en)) {
    const paper = parseNewspaperName(segment)
    if (paper) next.publication_zh = paper
  }

  if (type === 'Journal Article' && !trim(next.volume)) {
    const volume = parseJournalVolume(segment, next.year)
    if (volume) next.volume = volume
  }

  return next
}

function titlesAreSame(a: string, b: string): boolean {
  return !!a && !!b && stripBooks(a) === stripBooks(b)
}

/**
 * Book Section is stored both under that type and, for some chapter-in-a-book
 * rows, as Book / Edited Volume with a distinct article title and no editor.
 */
export function displaySourceType(source: Source): string {
  const type = trim(source.type)
  const title = firstNonEmpty(source.title_zh, source.title_en)
  const book = firstNonEmpty(source.book_zh, source.book_en)
  const editor = firstNonEmpty(source.editor_zh, source.editor_en)
  const chapter = !!title && !!book && !titlesAreSame(title, book)
  if (type === 'Book Section') return 'Book Section'
  if (type === 'Book' && chapter) return 'Book Section'
  if (type === 'Edited Volume' && chapter && !editor) return 'Book Section'
  return type
}

function journalIssue(source: Source): string {
  const journal = firstNonEmpty(source.publication_zh, source.publication_en)
  const year = yearWithNian(source.year)
  let vol = trim(source.volume)
  if (source.year != null) vol = vol.replace(new RegExp(`^${source.year}年`), '')
  if (vol && year && vol.includes(`${source.year}年`)) vol = vol.replace(`${source.year}年`, '')
  if (vol && /^\d+$/.test(vol)) vol = `第${vol}期`
  return [journal, year, vol].filter(Boolean).join('')
}

function bookPageBit(page: string): string {
  if (!page) return ''
  const cleaned = page.replace(/[。．.]$/, '')
  if (/[页頁]/.test(cleaned) || /^第/.test(cleaned)) return cleaned
  return `第${cleaned}页`
}

function formatByType(source: Source, page: string): string | null {
  const type = displaySourceType(source)
  if (!type) return null

  const authors = joinAuthors(source)
  const title = firstNonEmpty(source.title_zh, source.title_en)
  const book = firstNonEmpty(source.book_zh, source.book_en, type === 'Book' ? title : '')
  const editor = firstNonEmpty(source.editor_zh, source.editor_en)
  const journal = firstNonEmpty(source.publication_zh, source.publication_en)

  switch (type) {
    case 'Book Section': {
      // 作者：《文章题名》，《书名》，出版地点：出版社，年份，页码
      const bookTitle = wrapBookTitle(book)
      const article = wrapBookTitle(title)
      return joinCitationParts([
        authorThenTitle(authors, article),
        bookTitle && article && stripBooks(bookTitle) === stripBooks(article) ? '' : bookTitle,
        imprint(source),
        source.year != null ? String(source.year) : '',
        page,
      ])
    }
    case 'Book': {
      // 作者：《书名》，出版地点：出版社，年份年，第页码页。
      return ensureIdeographicPeriod(
        joinCitationParts([
          authorThenTitle(authors, wrapBookTitle(book || title)),
          imprint(source),
          yearWithNian(source.year),
          bookPageBit(page),
        ])
      )
    }
    case 'Journal Article': {
      // 作者：《文章题名》，刊名年份年第刊数，页码.
      return ensureAsciiPeriod(joinCitationParts([authorThenTitle(authors, wrapBookTitle(title)), journalIssue(source), page]))
    }
    case 'Newspaper': {
      // 作者：《文章题名》，《报纸名》年份年月份日期。
      const paper = wrapBookTitle(journal)
      const dated = `${paper}${formatZhDate(source.date, source.year)}`
      return ensureIdeographicPeriod(joinCitationParts([authorThenTitle(authors, wrapBookTitle(title)), dated]))
    }
    case 'Blog Post': {
      // 作者，文章题名，url
      return joinCitationParts([authors, title, extractUrl(source)])
    }
    case 'Edited Volume': {
      // 作者，文章题名，编者编：《书名》，出版地点：出版社，年份年，页码.
      const editorLabel = editor ? withBian(editor) : ''
      const titleLooksLikeBook = titlesAreSame(title, book)

      if (authors) {
        const editorBook = editorLabel ? `${editorLabel}：${wrapBookTitle(book)}` : wrapBookTitle(book)
        return ensureAsciiPeriod(
          joinCitationParts([
            authorThenTitle(authors, title, false),
            editorBook,
            imprint(source),
            yearWithNian(source.year),
            page,
          ])
        )
      }

      if (editorLabel && title && !titleLooksLikeBook) {
        return ensureAsciiPeriod(
          joinCitationParts([
            editorLabel,
            title,
            wrapBookTitle(book),
            imprint(source),
            yearWithNian(source.year),
            page,
          ])
        )
      }

      const bookBit = wrapBookTitle(book || title)
      return ensureAsciiPeriod(
        joinCitationParts([
          editorLabel && bookBit ? `${editorLabel}：${bookBit}` : editorLabel || bookBit,
          imprint(source),
          yearWithNian(source.year),
          page,
        ])
      )
    }
    default:
      // Museum / other typed rows: still assemble from fields, never paste citation_zh.
      return joinCitationParts([authors, title, extractUrl(source)]) || null
  }
}

function assembleFromFields(source: Source, page: string): string {
  const authors = joinAuthors(source)
  const title = firstNonEmpty(source.title_zh, source.title_en)
  return (
    joinCitationParts([
      authorThenTitle(authors, wrapBookTitle(title)),
      firstNonEmpty(source.publication_zh, source.publication_en),
      yearWithNian(source.year),
      page,
    ]) || '—'
  )
}

/**
 * Chinese bibliographic string for a sources row, following the per-type
 * rules used on the site References tab. `pageOverride` is source_links.page
 * when a citation cites a more specific span than the source row itself.
 * Always assembled from split columns (gaps filled from citation_zh pieces);
 * the raw citation string is never shown as-is.
 */
export function formatSourceCitation(
  source: Source,
  pageOverride?: string | null,
  options?: { includePage?: boolean }
): string {
  const filled = enrichSourceFields(source)
  const page = options?.includePage === false ? '' : firstNonEmpty(pageOverride, filled.page)
  return formatByType(filled, page) ?? assembleFromFields(filled, page)
}

export function sourceTypeLabel(type: string | null | undefined): string {
  return trim(type)
}

export function sourceDisplayType(source: Source | null | undefined): string {
  if (!source) return ''
  return displaySourceType(enrichSourceFields(source))
}
