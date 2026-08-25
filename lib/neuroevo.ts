// 신경진화(Neuroevolution) 엔진 — 게임별 AI 두뇌(작은 MLP)를 세대(generation)를 거쳐 진화시킨다.
// 단일 플레이어 게임이므로 마이크로 개체군(POP)을 판마다 하나씩 평가(round-robin) → 다 평가되면 선택·교배·변이로 다음 세대.
// 순전파(forward)는 게임 iframe(브라우저)에서 실행되고, 서버는 진화(선택/교배/변이)만 담당한다.
export const POP = 6          // 개체군 크기
export const HIDDEN = 6       // 은닉 뉴런 수
const MUT_RATE = 0.18, MUT_SCALE = 0.35, ELITE = 2

export interface Genome { g: number[]; f: number | null }
export interface Brain {
  arch: [number, number, number]   // [입력, 은닉, 출력]
  inputs: string[]                  // state() 키 (입력 노드 라벨)
  outputs: string[]                 // 행동 이름 (출력 노드 라벨)
  gen: number
  evalIdx: number
  pop: Genome[]
  best: { g: number[]; f: number }
  history: { gen: number; best: number; avg: number }[]
}

const rnd = () => Math.random() * 2 - 1
// 박스-뮬러 정규분포
const gauss = () => { const u = Math.random() || 1e-9, v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
export const genomeLen = (a: [number, number, number]) => a[0] * a[1] + a[1] + a[1] * a[2] + a[2]
const randGenome = (L: number) => Array.from({ length: L }, () => gauss() * 0.5)

export function createBrain(inputs: string[], outputs: string[]): Brain {
  const arch: [number, number, number] = [inputs.length, HIDDEN, outputs.length]
  const L = genomeLen(arch)
  const pop: Genome[] = Array.from({ length: POP }, () => ({ g: randGenome(L), f: null }))
  return { arch, inputs, outputs, gen: 0, evalIdx: 0, pop, best: { g: pop[0].g.slice(), f: -Infinity }, history: [] }
}

function mutate(g: number[]): number[] { return g.map(w => (Math.random() < MUT_RATE ? w + gauss() * MUT_SCALE : w)) }
function crossover(a: number[], b: number[]): number[] { return a.map((w, i) => (Math.random() < 0.5 ? w : b[i])) }

/** 한 판 결과(점수)를 현재 평가 중인 개체에 반영. 개체군을 다 평가하면 다음 세대로 진화. 반환: evolved 여부 */
export function recordFitness(brain: Brain, score: number): { evolved: boolean } {
  if (!brain.pop[brain.evalIdx]) brain.evalIdx = 0
  brain.pop[brain.evalIdx].f = score
  if (score > brain.best.f) brain.best = { g: brain.pop[brain.evalIdx].g.slice(), f: score }
  brain.evalIdx++
  if (brain.evalIdx < brain.pop.length) return { evolved: false }
  // 세대 종료 — 선택·교배·변이
  const scored = brain.pop.map(x => ({ ...x, f: x.f ?? -Infinity })).sort((a, b) => b.f - a.f)
  const fits = scored.map(x => x.f).filter(f => Number.isFinite(f))
  const avg = fits.length ? fits.reduce((s, f) => s + f, 0) / fits.length : 0
  brain.history.push({ gen: brain.gen, best: scored[0].f, avg: Math.round(avg * 10) / 10 })
  if (brain.history.length > 200) brain.history = brain.history.slice(-200)
  const elites = scored.slice(0, ELITE).map(x => ({ g: x.g.slice(), f: null }))
  const top = scored.slice(0, Math.max(2, Math.ceil(POP / 2)))
  const next: Genome[] = [...elites]
  while (next.length < POP) {
    const a = top[Math.floor(Math.random() * top.length)].g
    const b = top[Math.floor(Math.random() * top.length)].g
    next.push({ g: mutate(crossover(a, b)), f: null })
  }
  brain.pop = next; brain.gen++; brain.evalIdx = 0
  return { evolved: true }
}

/** 지금 게임에 배포할 개체(가중치) — 클라이언트가 순전파에 사용 */
export function activeGenome(brain: Brain) {
  const gm = brain.pop[brain.evalIdx] ?? brain.pop[0]
  return { arch: brain.arch, inputs: brain.inputs, outputs: brain.outputs, g: gm.g, gen: brain.gen, evalIdx: brain.evalIdx, pop: brain.pop.length }
}

/** 시각화용 — 최고 개체의 가중치를 층별 행렬로 (입력→은닉 w1, 은닉→출력 w2) */
export function brainWeights(brain: Brain) {
  const [ni, nh, no] = brain.arch, g = brain.best.g
  let k = 0
  const w1: number[][] = Array.from({ length: ni }, () => Array.from({ length: nh }, () => g[k++]))
  k += nh // b1 건너뜀
  const w2: number[][] = Array.from({ length: nh }, () => Array.from({ length: no }, () => g[k++]))
  return { arch: brain.arch, inputs: brain.inputs, outputs: brain.outputs, w1, w2, gen: brain.gen, fitness: brain.best.f, history: brain.history }
}
