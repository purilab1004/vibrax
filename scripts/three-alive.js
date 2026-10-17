// THREE.makeAlive(model) — 뼈대(리깅) 없는 AI 3D 모델에 생기를 넣는 절차적 움직임.
// 모델의 자식들을 발밑 기준 '안쪽 그룹'으로 옮겨 그 그룹만 흔든다 → 게임 코드는 model 의 위치·회전을 마음대로 바꿔도 된다.
//   const alive = THREE.makeAlive(gltf.scene)
//   매 프레임: alive.update(dt, 'idle' | 'walk' | 'run' | 'jump' | 'fall')   (dt 초)
//   순간 동작: alive.trigger('attack' | 'hit' | 'land' | 'spin' | 'happy')
// 리깅된 모델(뼈대가 있으면, 예: 디자인 AI '움직이게 만들기')은 뼈대 모양으로 다리·팔·머리를 찾아 걷기·달리기·공격 때 팔다리를 흔든다.
// three-addons.js 끝에 붙는다 (scripts/build-three-addons.mjs).
;(function () {
  var T = globalThis.THREE
  if (!T) return
  // 뼈대 → 역할(다리·팔·머리). 이름에 기대지 않고 위치로 찾는다(자동 리깅 뼈 이름은 제각각)
  function findLimbs(model, box) {
    var bones = []
    model.traverse(function (n) { if (n.isBone) bones.push(n) })
    if (bones.length < 4) return null
    model.updateMatrixWorld(true)
    var h = box.max.y - box.min.y, w = Math.max(1e-3, box.max.x - box.min.x), cx = (box.max.x + box.min.x) / 2
    var P = function (b) { return model.worldToLocal(b.getWorldPosition(new T.Vector3())) }
    var kids = function (b) { return b.children.filter(function (c) { return c.isBone }) }
    var leaves = bones.filter(function (b) { return kids(b).length === 0 })
    var path = function (b) { var a = []; while (b && b.isBone) { a.unshift(b); b = b.parent } return a }
    var after = function (pa, pb) { var i = 0; while (i < pa.length && i < pb.length && pa[i] === pb[i]) i++; return pa.slice(i) }  // 갈라진 뒤 쪽
    var lowL = null, lowR = null, armL = null, armR = null, top = null
    leaves.forEach(function (b) {
      var p = P(b)
      if (!top || p.y > P(top).y) top = b
      if ((p.y - box.min.y) / h < 0.3) { if (p.x >= cx && (!lowL || p.y < P(lowL).y)) lowL = b; if (p.x < cx && (!lowR || p.y < P(lowR).y)) lowR = b }
    })
    // 팔: 다리·머리 끝이 아닌 나머지 끝 중 좌우로 가장 바깥 (팔을 내리고 있어도 찾도록 높이 대신 뼈대 구조로)
    leaves.forEach(function (b) {
      if (b === lowL || b === lowR || b === top) return
      var p = P(b), side = p.x - cx
      if (Math.abs(side) < w * 0.05) return
      if (side > 0 && (!armL || side > P(armL).x - cx)) armL = b
      if (side < 0 && (!armR || side < P(armR).x - cx)) armR = b
    })
    var chain = function (leaf, other) { if (!leaf) return null; var c = other ? after(path(leaf), path(other)) : path(leaf).slice(-2); return c.length ? c : null }
    var arm = function (c) { return c && c.length >= 3 ? c.slice(1) : c }  // 쇄골 다음(위팔)부터
    var L = { legL: chain(lowL, lowR), legR: chain(lowR, lowL), armL: arm(chain(armL, armR || top)), armR: arm(chain(armR, armL || top)), head: top ? [top.parent && top.parent.isBone ? top.parent : top] : null }
    var all = [].concat(L.legL || [], L.legR || [], L.armL || [], L.armR || [], L.head || [])
    if (!L.legL && !L.armL) return null
    all.forEach(function (b) {
      if (b.userData.rest) return
      var pq = new T.Quaternion(); if (b.parent) b.parent.getWorldQuaternion(pq)
      var mq = new T.Quaternion(); model.getWorldQuaternion(mq)
      b.userData.rest = b.quaternion.clone()
      b.userData.toLocal = pq.invert().multiply(mq)  // 모델 기준 축 → 부모 기준 축
    })
    return L
  }
  var AX = new T.Vector3(), Q = new T.Quaternion()
  // 모델 기준 축(ax,ay,az)으로 angle 만큼 돌린 자세 = rest 위에 덧씌움
  function turn(b, ax, ay, az, angle) {
    if (!b || !b.userData.rest) return
    AX.set(ax, ay, az).applyQuaternion(b.userData.toLocal).normalize()
    Q.setFromAxisAngle(AX, angle)
    b.quaternion.copy(Q).multiply(b.userData.rest)
  }
  T.makeAlive = function (model, opts) {
    opts = opts || {}
    var inner = new T.Group()
    inner.name = 'alive'
    while (model.children.length) inner.add(model.children[0])
    model.add(inner)
    var box = new T.Box3().setFromObject(inner)
    var h = Math.max(1e-3, box.max.y - box.min.y)
    // 발밑을 원점으로 → 늘이고 눌러도 발이 땅에 붙어 있다
    inner.children.forEach(function (c) { c.position.y -= box.min.y })
    inner.position.y = box.min.y
    var baseY = box.min.y
    var limbs = findLimbs(model, box)
    var mats = []
    model.traverse(function (n) { var m = n.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(function (q) { if (q && q.emissive && mats.indexOf(q) < 0) mats.push(q) }) })
    var t = Math.random() * 10, state = 'idle', blend = 0, one = null, oneT = 0, prevAir = false
    var amp = opts.amount == null ? (limbs ? 0.55 : 1) : opts.amount   // 팔다리가 움직이면 몸 흔들기는 줄인다
    var s = { y: 0, sx: 1, sy: 1, rx: 0, rz: 0, ry: 0, z: 0 }
    var lerp = function (a, b, k) { return a + (b - a) * k }
    var api = {
      object: inner,
      rigged: !!limbs,
      trigger: function (name) { one = name; oneT = 0 },
      update: function (dt, st) {
        dt = Math.min(0.1, dt || 0.016); t += dt
        if (st) state = st
        var air = state === 'jump' || state === 'fall'
        if (prevAir && !air) api.trigger('land')
        prevAir = air
        var tg = { y: 0, sx: 1, sy: 1, rx: 0, rz: 0, ry: 0, z: 0 }
        if (state === 'walk' || state === 'run') {
          var f = state === 'run' ? 13 : 8.5, a = state === 'run' ? 1.6 : 1
          var step = Math.abs(Math.sin(t * f))
          tg.y = step * 0.07 * h * a
          tg.rz = Math.sin(t * f) * 0.09 * a
          tg.rx = 0.07 * a + step * 0.03
          tg.sy = 1 + (step - 0.5) * 0.06 * a; tg.sx = 1 - (step - 0.5) * 0.03 * a
        } else if (state === 'jump') {
          tg.sy = 1.12; tg.sx = 0.93; tg.rx = -0.06
        } else if (state === 'fall') {
          tg.sy = 1.05; tg.sx = 0.97; tg.rx = 0.05
        } else { // idle: 숨쉬기 + 살짝 흔들림
          tg.sy = 1 + Math.sin(t * 2.2) * 0.025; tg.sx = 1 - Math.sin(t * 2.2) * 0.012
          tg.rz = Math.sin(t * 1.1) * 0.035; tg.ry = Math.sin(t * 0.6) * 0.08
        }
        // 순간 동작
        var flash = 0
        if (one) {
          oneT += dt
          var d = { attack: 0.32, hit: 0.4, land: 0.22, spin: 0.6, happy: 0.7 }[one] || 0.3, k = Math.min(1, oneT / d), e = Math.sin(k * Math.PI)
          if (one === 'attack') { tg.rx += -0.45 * e; tg.z = 0.25 * h * e; tg.sy *= 1 - 0.06 * e }
          else if (one === 'hit') { tg.rz += Math.sin(oneT * 60) * 0.12 * (1 - k); tg.rx += 0.2 * e; flash = 1 - k }
          else if (one === 'land') { tg.sy *= 1 - 0.18 * e; tg.sx *= 1 + 0.1 * e }
          else if (one === 'spin') { tg.ry += k * Math.PI * 2 }
          else if (one === 'happy') { tg.y += Math.abs(Math.sin(k * Math.PI * 3)) * 0.18 * h; tg.sy *= 1 + 0.05 * e }
          if (k >= 1) one = null
        }
        var r = 1 - Math.pow(0.0005, dt) // 프레임과 무관한 부드러운 보간
        for (var key in s) s[key] = lerp(s[key], tg[key], key === 'ry' && one === 'spin' ? 1 : r)
        inner.position.set(0, baseY + s.y * amp, s.z * amp)
        inner.rotation.set(s.rx * amp, s.ry, s.rz * amp)
        inner.scale.set(lerp(1, s.sx, amp), lerp(1, s.sy, amp), lerp(1, s.sx, amp))
        for (var i = 0; i < mats.length; i++) mats[i].emissive.setRGB(flash * 0.9, flash * 0.1, flash * 0.1)
        if (limbs) {
          // 팔다리: 앞뒤 흔들기는 X 축, 옆으로 들기는 Z 축 (모델은 +Z 가 앞)
          var moving = state === 'walk' || state === 'run', fq = state === 'run' ? 13 : 8.5, sw = state === 'run' ? 0.85 : 0.5
          var ph = Math.sin(t * fq), legA = moving ? ph * sw : 0, armA = moving ? -ph * sw * 0.8 : Math.sin(t * 2.2) * 0.05
          var air = state === 'jump' || state === 'fall'
          if (air) { legA = 0.35; armA = -0.6 }
          limbs._s = limbs._s || { lL: 0, lR: 0, aL: 0, aR: 0, kL: 0, kR: 0, raise: 0, hd: 0 }
          var g = { lL: legA, lR: air ? -0.2 : -legA, aL: armA, aR: air ? -0.6 : -armA, kL: moving ? Math.max(0, -ph) * sw * 1.1 : air ? 0.5 : 0, kR: moving ? Math.max(0, ph) * sw * 1.1 : air ? 0.5 : 0, raise: 0, hd: state === 'idle' ? Math.sin(t * 0.9) * 0.12 : 0 }
          if (one === 'attack') g.aR = -1.9 * Math.sin(Math.min(1, oneT / 0.32) * Math.PI)
          if (one === 'happy') g.raise = 2.2 * Math.sin(Math.min(1, oneT / 0.7) * Math.PI)
          if (one === 'hit') g.hd = -0.4 * (1 - Math.min(1, oneT / 0.4))
          var ls = limbs._s
          for (var kk in g) ls[kk] = lerp(ls[kk], g[kk], one === 'attack' && kk === 'aR' ? 1 : r)
          if (limbs.legL) { turn(limbs.legL[0], 1, 0, 0, ls.lL); if (limbs.legL[1]) turn(limbs.legL[1], 1, 0, 0, -ls.kL) }
          if (limbs.legR) { turn(limbs.legR[0], 1, 0, 0, ls.lR); if (limbs.legR[1]) turn(limbs.legR[1], 1, 0, 0, -ls.kR) }
          if (limbs.armL) turn(limbs.armL[0], 1, 0, 0, ls.aL), ls.raise && limbs.armL[0].quaternion.premultiply(Q.setFromAxisAngle(AX.set(0, 0, 1).applyQuaternion(limbs.armL[0].userData.toLocal).normalize(), ls.raise))
          if (limbs.armR) turn(limbs.armR[0], 1, 0, 0, ls.aR), ls.raise && limbs.armR[0].quaternion.premultiply(Q.setFromAxisAngle(AX.set(0, 0, 1).applyQuaternion(limbs.armR[0].userData.toLocal).normalize(), -ls.raise))
          if (limbs.head) turn(limbs.head[0], 0, 1, 0, ls.hd)
        }
      },
    }
    return api
  }
})();
