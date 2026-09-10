import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarize, compare, decide, inputKeys, contractGate, DEFAULT_DESIGN } from './design-score'

const sess = (n: number, dur: number, overs = 0, cleared = false) => Array.from({ length: n }, () => ({ duration_sec: dur, game_overs: overs, cleared }))

test('summarize: 이탈률·체류·재시작·클리어', () => {
  const m = summarize([...sess(5, 10), ...sess(5, 100, 2, true)])
  assert.equal(m.sessions, 10)
  assert.equal(m.under30sRate, 0.5)
  assert.equal(m.restartRate, 0.5)
  assert.equal(m.clearRate, 0.5)
})

test('summarize: 게임오버·클리어가 전혀 없으면 null (클리어 조건 없는 게임)', () => {
  const m = summarize(sess(10, 40))
  assert.equal(m.restartRate, null)
  assert.equal(m.clearRate, null)
})

test('compare: 이탈률 감소 + 체류 증가면 양수 점수', () => {
  const a = summarize([...sess(20, 10), ...sess(20, 60)])
  const b = summarize([...sess(10, 10), ...sess(30, 60)])
  const r = compare(a, b)
  assert.ok(r.score > 0, `score ${r.score}`)
  assert.ok(r.deltas.dropout > 0)
})

test('decide: 표본 부족이면 continue, 기간 만료면 inconclusive', () => {
  const a = summarize(sess(5, 40)), b = summarize(sess(5, 40))
  assert.equal(decide(a, b, 1).verdict, 'continue')
  assert.equal(decide(a, b, 8).verdict, 'inconclusive')
})

test('decide: 충분한 표본 + 큰 개선 → adopt', () => {
  const a = summarize([...sess(20, 10), ...sess(20, 60, 2)])
  const b = summarize([...sess(8, 10), ...sess(32, 80, 2)])
  const d = decide(a, b, 3)
  assert.equal(d.verdict, 'adopt', d.reason)
})

test('decide: 어떤 지표가 크게 악화되면 채택 불가', () => {
  // 체류는 늘었지만 재시작률이 붕괴
  const a = summarize([...sess(20, 10), ...sess(20, 60, 2)])
  const b = summarize([...sess(10, 10), ...sess(30, 90, 1)])
  const d = decide(a, b, 3)
  assert.notEqual(d.verdict, 'adopt')
})

test('decide: 카나리 이탈률이 1.5배 넘으면 표본 전이라도 조기 복귀', () => {
  const a = summarize([...sess(10, 10), ...sess(10, 60)])   // 50%
  const b = summarize([...sess(9, 10), ...sess(1, 60)])     // 90%
  const d = decide(a, b, 1, { ...DEFAULT_DESIGN, earlyMinSessions: 10 })
  assert.equal(d.verdict, 'revert')
})

test('inputKeys: VIBREX_GAME inputs 키 추출', () => {
  const html = 'window.VIBREX_GAME = { title: "x", inputs: { left(on){}, right(on){}, jump: function(on){} } , state(){} }'
  assert.deepEqual(inputKeys(html), ['jump', 'left', 'right'])
})

test('contractGate: 조작 채널이 바뀌면 실패, 같으면 통과', () => {
  const base = '<html><head><title>A</title></head><body><script>window.VIBREX_GAME={inputs:{left(on){},right(on){}}}</script></body></html>'
  const same = base.replace('<title>A</title>', '<title>A2</title>') + ' '.repeat(20)
  const changed = base.replace('right(on){}', 'fire(on){}')
  assert.equal(contractGate(base, same, base.length).ok, true)
  assert.equal(contractGate(base, changed, base.length).ok, false)
  assert.equal(contractGate(base, base.repeat(3), base.length).ok, false)
})
