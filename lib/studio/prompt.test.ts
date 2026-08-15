import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMessages, SYSTEM_PROMPT } from './prompt'

test('첫 생성: 요청만 담긴 user 메시지 1개', () => {
  const msgs = buildMessages({ prompt: '점프 게임 만들어줘', currentHtml: null, history: [] })
  assert.equal(msgs.length, 1)
  assert.equal(msgs[0].role, 'user')
  assert.match(msgs[0].content, /점프 게임 만들어줘/)
  assert.doesNotMatch(msgs[0].content, /<game>/)
})

test('수정: 현재 HTML이 user 메시지에 포함된다', () => {
  const msgs = buildMessages({
    prompt: '배경을 파랗게', currentHtml: '<html>v1</html>',
    history: [
      { role: 'user', content: '점프 게임 만들어줘' },
      { role: 'assistant', content: '만들었어요' },
    ],
  })
  const last = msgs[msgs.length - 1]
  assert.equal(last.role, 'user')
  assert.match(last.content, /<game><html>v1<\/html><\/game>/)
  assert.match(last.content, /배경을 파랗게/)
})

test('역할 교대: 연속 같은 role은 병합, 선두 assistant 제거, 마지막은 user', () => {
  const msgs = buildMessages({
    prompt: '다음', currentHtml: null,
    history: [
      { role: 'assistant', content: '떠돌이 인사' },
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
      { role: 'assistant', content: 'c' },
    ],
  })
  assert.equal(msgs[0].role, 'user')
  for (let i = 1; i < msgs.length; i++) assert.notEqual(msgs[i].role, msgs[i - 1].role)
  assert.equal(msgs[msgs.length - 1].role, 'user')
})

test('history는 최근 6턴만 사용한다', () => {
  const history = Array.from({ length: 20 }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `m${i}`,
  }))
  const msgs = buildMessages({ prompt: '다음', currentHtml: null, history })
  assert.ok(msgs.length <= 7)
  assert.ok(!msgs.some(m => m.content === 'm0'))
})

test('시스템 프롬프트는 출력 형식과 외부 리소스 금지를 명시한다', () => {
  assert.match(SYSTEM_PROMPT, /<game>/)
  assert.match(SYSTEM_PROMPT, /외부 리소스/)
})
