// THREE.makeAlive(model) — 뼈대(리깅) 없는 AI 3D 모델에 생기를 넣는 절차적 움직임.
// 모델의 자식들을 발밑 기준 '안쪽 그룹'으로 옮겨 그 그룹만 흔든다 → 게임 코드는 model 의 위치·회전을 마음대로 바꿔도 된다.
//   const alive = THREE.makeAlive(gltf.scene)
//   매 프레임: alive.update(dt, 'idle' | 'walk' | 'run' | 'jump' | 'fall')   (dt 초)
//   순간 동작: alive.trigger('attack' | 'hit' | 'land' | 'spin' | 'happy')
// three-addons.js 끝에 붙는다 (scripts/build-three-addons.mjs).
;(function () {
  var T = globalThis.THREE
  if (!T) return
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
    var mats = []
    model.traverse(function (n) { var m = n.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(function (q) { if (q && q.emissive && mats.indexOf(q) < 0) mats.push(q) }) })
    var t = Math.random() * 10, state = 'idle', blend = 0, one = null, oneT = 0, prevAir = false
    var amp = opts.amount == null ? 1 : opts.amount
    var s = { y: 0, sx: 1, sy: 1, rx: 0, rz: 0, ry: 0, z: 0 }
    var lerp = function (a, b, k) { return a + (b - a) * k }
    var api = {
      object: inner,
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
      },
    }
    return api
  }
})();
