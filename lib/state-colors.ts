/** Shared state → tag-color mapping, so a state reads the same color
 * wherever it shows up as a tag (mint town cards, coin type cards, ...). */
const STATE_COLORS: Record<string, string> = {
  Wei: 'bg-amber-100 text-amber-800',
  Zhao: 'bg-blue-100 text-blue-800',
  Yan: 'bg-green-100 text-green-800',
  Zhongshan: 'bg-purple-100 text-purple-800',
  Qi: 'bg-rose-100 text-rose-800',
  Qin: 'bg-orange-100 text-orange-800',
  Han: 'bg-sky-100 text-sky-800',
}

export function stateTagColor(state_en: string | null | undefined): string {
  return (state_en && STATE_COLORS[state_en]) ?? 'bg-gray-100 text-gray-700'
}
