// lib/aj/imitation.ts — 사람 선택 모방: 후보 평가 가중치를 사람의 선택이 1등이 되도록 맞춘다 (순수 함수, LLM 없음)
/** 사람 선택 데이터로 평가 가중치 탐색: 사람이 고른 후보가 argmax 가 되는 비율(+마진)을 최대화 */
export function fitWeightsFromChoices(choices: { names: string[]; cands: { id: string; f: number[] }[]; chosen: string }[], base: number[] | null): { w: number[]; agree: number; baseAgree: number } | null {
  const usable = choices.filter(c => c.cands.length >= 2 && c.cands.some(k => k.id === c.chosen))
  if (usable.length < 10) return null
  const dim = usable[0].names.length
  const sameDim = usable.filter(c => c.names.length === dim && c.cands.every(k => k.f.length === dim))
  // 특징 스케일 정규화(각 특징의 표준편차)
  const sd = new Array(dim).fill(0)
  for (let d = 0; d < dim; d++) { const vals = sameDim.flatMap(c => c.cands.map(k => k.f[d])); const m = vals.reduce((a, v) => a + v, 0) / vals.length; sd[d] = Math.sqrt(vals.reduce((a, v) => a + (v - m) ** 2, 0) / vals.length) || 1 }
  const score = (w: number[]) => {
    let agree = 0, margin = 0
    for (const c of sameDim) {
      const s = c.cands.map(k => k.f.reduce((a, v, i) => a + v * w[i], 0))
      const ci = c.cands.findIndex(k => k.id === c.chosen); const best = Math.max(...s); const second = Math.max(...s.filter((_, i) => i !== ci))
      if (s[ci] >= best) agree++
      margin += Math.tanh((s[ci] - second) / (Math.abs(second) + 1))
    }
    return { agree: agree / sameDim.length, obj: agree / sameDim.length + 0.05 * margin / sameDim.length }
  }
  const cur = base && base.length === dim ? base.slice() : new Array(dim).fill(0).map((_, i) => (i === 0 ? 1 : -1) / sd[i])
  const baseAgree = score(cur).agree
  let best = { w: cur.slice(), ...score(cur) }
  let step = 0.6
  for (let it = 0; it < 1200; it++) {
    const w = best.w.map((v, i) => v * Math.exp((Math.random() - 0.5) * 2 * step) + (Math.random() < 0.15 ? (Math.random() - 0.5) * step / sd[i] : 0))
    const sc = score(w)
    if (sc.obj > best.obj) best = { w, ...sc }
    if (it % 300 === 299) step *= 0.6
  }
  return { w: best.w.map(v => Math.round(v * 10000) / 10000), agree: best.agree, baseAgree }
}
