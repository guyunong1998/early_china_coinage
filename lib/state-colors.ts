/** Shared state → tag-color mapping, so a state reads the same color
 * wherever it shows up as a tag (mint town cards, coin type cards, ...).
 * Keyed by state_zh, not state_en — 韩 (Warring States Han) and 汉 (Han
 * dynasty) both have state_en "Han" in the database, so keying by the
 * English name can't tell them apart. */
const STATE_COLORS: Record<string, string> = {
  魏: 'bg-amber-100 text-amber-800', // Wei
  赵: 'bg-blue-100 text-blue-800', // Zhao
  燕: 'bg-green-100 text-green-800', // Yan
  中山: 'bg-purple-100 text-purple-800', // Zhongshan
  齐: 'bg-rose-100 text-rose-800', // Qi
  秦: 'bg-orange-100 text-orange-800', // Qin
  韩: 'bg-sky-100 text-sky-800', // Han (Warring States)
  汉: 'bg-red-100 text-red-800', // Han (dynasty)
  楚: 'bg-teal-100 text-teal-800', // Chu
  晋: 'bg-lime-100 text-lime-800', // Jin
  三晋: 'bg-cyan-100 text-cyan-800', // San Jin
  周: 'bg-indigo-100 text-indigo-800', // Zhou
  东周: 'bg-violet-100 text-violet-800', // Eastern Zhou
  新莽: 'bg-fuchsia-100 text-fuchsia-800', // Xin Mang
}

export function stateTagColor(state_zh: string | null | undefined): string {
  return (state_zh && STATE_COLORS[state_zh]) ?? 'bg-gray-100 text-gray-700'
}
