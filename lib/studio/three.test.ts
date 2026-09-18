import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hardenHtml, THREE_URL } from './harden'

test('3D 게임이면 자체 호스팅 three.js 를 head 맨 앞에 넣는다', () => {
  const out = hardenHtml('<!DOCTYPE html><html><head><title>3D</title></head><body><script>const s=new THREE.Scene()</script></body></html>')
  assert.ok(out.includes(`<script src="${THREE_URL}"></script>`))
  assert.ok(out.indexOf(THREE_URL) < out.indexOf('new THREE.Scene'))
})

test('CDN three 태그는 우리 사본으로 교체된다', () => {
  const out = hardenHtml('<!DOCTYPE html><html><head><script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script></head><body><script>new THREE.Scene()</script></body></html>')
  assert.ok(!out.includes('cdn.jsdelivr.net'))
  assert.equal(out.split(THREE_URL).length - 1, 1)
})

test('2D 게임에는 three.js 를 넣지 않는다', () => {
  const out = hardenHtml('<!DOCTYPE html><html><head><title>2D</title></head><body><canvas></canvas></body></html>')
  assert.ok(!out.includes('three.min.js'))
})
