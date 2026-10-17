// THREE.makeAlive(model) — 뼈대(리깅) 없는 AI 3D 모델에 생기를 넣는 절차적 움직임.
// 모델의 자식들을 발밑 기준 '안쪽 그룹'으로 옮겨 그 그룹만 흔든다 → 게임 코드는 model 의 위치·회전을 마음대로 바꿔도 된다.
//   const alive = THREE.makeAlive(gltf)   (gltf.scene 만 줘도 된다 — gltf 를 주면 파일에 든 움직임 클립을 쓴다)
//   매 프레임: alive.update(dt, 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'sit' | 'kneel' | 'strafe_left' | 'strafe_right' | 'aim')   (dt 초)
//   총: trigger('shoot') 하면 총구 불꽃과 총알이 나간다. 'kneel' 상태 + 총이면 무릎 쏴 자세. 칼·양손검 공격은 연속으로 부를 때마다 다른 베기
//   점프: 땅 → 'jump' 로 바뀌면 웅크렸다 박차는 동작, 다시 땅으로 오면 착지 동작이 자동으로 나온다
//   순간 동작: alive.trigger('attack' | 'hit' | 'land' | 'spin' | 'happy' | 'talk')   말하기: alive.update(dt, 'talk') 또는 alive.say(초)
//   얼굴(파일에 __face_blink·__face_mouth·__face_both 판이 있으면): 몇 초마다 눈 깜박, 말하기·공격·기쁨·맞기 때 입을 연다
//   무기: alive.equip('sword' | 'sword_shield' | 'greatsword' | 'gun' | 'none' | 무기 Object3D) — 손 뼈에 붙고 자세가 바뀐다.
//         그 뒤 trigger('attack') = 무기에 맞는 베기·내려치기·쏘기, trigger('shoot'), trigger('block'), trigger('die') (쓰러져 있음 → alive.revive())
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
  T.makeAlive = function (arg, opts) {
    opts = opts || {}
    var model = arg && arg.scene && arg.scene.isObject3D ? arg.scene : arg
    var clips = (arg && arg.animations) || opts.animations || []
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
    // GLB 안에 움직임 클립(idle·walk·run·jump·attack·happy·hit)이 있으면 그걸 틀고, 없으면 뼈대·몸을 직접 흔든다
    var named = {}
    clips.forEach(function (c) { named[String(c.name).toLowerCase()] = c })
    var mixer = named.walk || named.idle ? new T.AnimationMixer(model) : null
    var acts = {}, cur = null, oneAct = null
    if (mixer) for (var cn in named) { acts[cn] = mixer.clipAction(named[cn]) }
    var play = function (name) {
      var a = acts[name] || (name === 'run' || /^strafe/.test(name) ? acts.walk : name === 'fall' ? acts.jump : null) || acts.idle
      if (!a || a === cur) return
      a.reset().setLoop(T.LoopRepeat, Infinity).fadeIn(0.18).play()
      if (cur) cur.fadeOut(0.18)
      cur = a
    }
    var limbs = mixer ? null : findLimbs(model, box)
    // 얼굴 판(눈 감음·입 벌림 텍스처) — 숨겨 두고 본 메시의 텍스처를 바꿔 낀다
    var face = null
    ;(function () {
      var alt = {}, main = null
      model.traverse(function (n) {
        if (!n.isMesh) return
        if (/^__face_/.test(n.name)) { alt[n.name.slice(7)] = n.material && n.material.map; n.visible = false; return }
        if (!main || n.geometry.attributes.position.count > main.geometry.attributes.position.count) main = n
      })
      if (main && main.material && main.material.map && alt.blink && alt.mouth) {
        var base = main.material.map
        ;[alt.blink, alt.mouth, alt.both].forEach(function (tx) { if (tx) { tx.flipY = base.flipY; tx.encoding = base.encoding; if ('colorSpace' in base) tx.colorSpace = base.colorSpace } })
        face = { mesh: main, base: base, alt: alt, cur: base, nextBlink: 1.5 + Math.random() * 2.5, blinkT: 0 }
      }
    })()
    var talkLeft = 0
    // 뼈대 정보(디자인 AI 리깅이 넣는 extras: 체형·손·머리 뼈 이름)
    var info = {}
    model.traverse(function (n) { if (n.userData && n.userData.vibrex) { try { info = typeof n.userData.vibrex === 'string' ? JSON.parse(n.userData.vibrex) : n.userData.vibrex } catch (e) {} } })
    var boneBy = function (nm) { var f = null; if (nm) model.traverse(function (n) { if (!f && n.isBone && (n.name === nm || n.name === nm.replace(/[^\w-]/g, '_'))) f = n }); return f }
    var handR = boneBy(info.handR) || (limbs && limbs.armR ? limbs.armR[limbs.armR.length - 1] : null)
    var handL = boneBy(info.handL) || (limbs && limbs.armL ? limbs.armL[limbs.armL.length - 1] : null)
    var stance = 'none', weapons = [], dead = false, combo = 0, bullets = []
    function fire() {
      var gun = weapons[0]; if (!gun) return
      var mz = gun.getObjectByName('muzzle'); if (!mz) return
      var root = model.parent || model
      var pos = mz.getWorldPosition(new T.Vector3()), q = mz.getWorldQuaternion(new T.Quaternion())
      var dir = new T.Vector3(0, 0, 1).applyQuaternion(q).normalize()
      var inv = new T.Matrix4().copy(root.matrixWorld).invert()
      // 총구 불꽃
      var flash = new T.Mesh(new T.SphereGeometry(0.05 * h, 10, 8), new T.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 1, depthWrite: false }))
      flash.position.copy(pos).applyMatrix4(inv); root.add(flash)
      // 총알(빛 줄기)
      var b = new T.Mesh(new T.CylinderGeometry(0.008 * h, 0.008 * h, 0.12 * h, 6), new T.MeshBasicMaterial({ color: 0xfff1b0 }))
      b.position.copy(pos).applyMatrix4(inv); b.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir); root.add(b)
      bullets.push({ m: b, v: dir.multiplyScalar(h * 9), life: 0.7 }, { m: flash, v: null, life: 0.07, flash: true })
    }
    var STANCE_IDLE = { sword: 'sword_idle', sword_shield: 'sword_idle', greatsword: 'greatsword_idle', gun: 'gun_idle' }
    var STANCE_ATTACK = { sword: 'sword_slash', sword_shield: 'sword_slash', greatsword: 'greatsword_slash', gun: 'gun_shoot' }
    var mat = function (c, m) { return new T.MeshStandardMaterial({ color: c, metalness: m || 0.2, roughness: 0.5 }) }
    // 간단한 무기 모양 (모델 키 h 기준). 그룹의 +Y = 칼날 방향, 총은 +Z = 총구 방향
    function makeWeapon(kind) {
      var g = new T.Group(); g.name = 'weapon_' + kind
      if (kind === 'sword' || kind === 'greatsword') {
        var L = kind === 'greatsword' ? 0.8 : 0.5, W = kind === 'greatsword' ? 0.07 : 0.04
        var blade = new T.Mesh(new T.BoxGeometry(W * h, L * h, 0.012 * h), mat(0xdfe6ee, 0.6)); blade.position.y = (L / 2 + 0.04) * h
        var guard = new T.Mesh(new T.BoxGeometry(W * 3.4 * h, 0.025 * h, 0.035 * h), mat(0xc8a03c, 0.5)); guard.position.y = 0.035 * h
        var grip = new T.Mesh(new T.CylinderGeometry(0.016 * h, 0.016 * h, (kind === 'greatsword' ? 0.2 : 0.11) * h, 8), mat(0x5a3a22)); grip.position.y = -0.03 * h
        g.add(blade, guard, grip)
      } else if (kind === 'shield') {
        var disc = new T.Mesh(new T.CylinderGeometry(0.2 * h, 0.2 * h, 0.025 * h, 24), mat(0x7a4a24)); disc.rotation.x = Math.PI / 2
        var boss = new T.Mesh(new T.SphereGeometry(0.05 * h, 12, 8), mat(0xc8a03c, 0.6)); boss.position.z = 0.02 * h
        g.add(disc, boss)
      } else if (kind === 'gun') {
        // 소총: 개머리판(뒤) — 몸통 — 긴 총열(앞, +Z). 오른손이 방아쇠 자리
        var stock = new T.Mesh(new T.BoxGeometry(0.045 * h, 0.08 * h, 0.18 * h), mat(0x6b4426)); stock.position.set(0, -0.015 * h, -0.12 * h)
        var body = new T.Mesh(new T.BoxGeometry(0.05 * h, 0.06 * h, 0.26 * h), mat(0x2b2f36, 0.5)); body.position.z = 0.1 * h
        var fore = new T.Mesh(new T.BoxGeometry(0.045 * h, 0.045 * h, 0.2 * h), mat(0x6b4426)); fore.position.set(0, -0.012 * h, 0.3 * h)
        var barrel = new T.Mesh(new T.CylinderGeometry(0.011 * h, 0.011 * h, 0.36 * h, 10), mat(0x15171b, 0.7)); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.018 * h, 0.42 * h)
        var grip = new T.Mesh(new T.BoxGeometry(0.035 * h, 0.08 * h, 0.04 * h), mat(0x3b2a1e)); grip.position.set(0, -0.06 * h, 0.0); grip.rotation.x = 0.35
        var muzzle = new T.Object3D(); muzzle.name = 'muzzle'; muzzle.position.set(0, 0.018 * h, 0.61 * h)
        g.add(stock, body, fore, barrel, grip, muzzle)
      }
      return g
    }
    // 손 뼈에 붙이기 — 기본 자세에서 모델 기준 방향으로 놓고 뼈에 붙여(attach) 손을 따라 움직이게
    function attachTo(bone, obj, dir, offset, poseClip) {
      if (!bone) { model.add(obj); return }
      if (mixer) mixer.stopAllAction()
      model.traverse(function (n) { if (n.isSkinnedMesh && n.skeleton) n.skeleton.pose() })
      // 그 무기를 쓰는 자세(겨누기·막기 등)에서 방향을 맞춰 붙인다 — 기본 자세에서 붙이면 자세가 바뀔 때 엉뚱한 쪽을 본다
      if (mixer && poseClip && acts[poseClip]) { var pa = acts[poseClip]; pa.reset().play(); mixer.setTime(0.12); pa.stop() ; pa.reset().play(); mixer.update(0.12) }
      model.updateMatrixWorld(true)
      var p = bone.getWorldPosition(new T.Vector3())
      if (offset) p.add(offset.clone().applyQuaternion(model.getWorldQuaternion(new T.Quaternion())))
      var mq = model.getWorldQuaternion(new T.Quaternion())
      obj.position.copy(p)
      obj.quaternion.copy(mq).multiply(dir)
      model.parent ? model.parent.add(obj) : model.add(obj)
      obj.updateMatrixWorld(true)
      bone.attach(obj)
      if (mixer) mixer.stopAllAction()
      cur = null; oneAct = null
    }
    var mats = []
    model.traverse(function (n) { var m = n.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(function (q) { if (q && q.emissive && mats.indexOf(q) < 0) mats.push(q) }) })
    var t = Math.random() * 10, state = 'idle', blend = 0, one = null, oneT = 0, prevAir = false
    var amp = opts.amount == null ? (mixer ? 0.3 : limbs ? 0.55 : 1) : opts.amount   // 팔다리가 움직이면 몸 흔들기는 줄인다
    var s = { y: 0, sx: 1, sy: 1, rx: 0, rz: 0, ry: 0, z: 0 }
    var lerp = function (a, b, k) { return a + (b - a) * k }
    var api = {
      object: inner,
      rigged: !!(limbs || mixer),
      animated: !!mixer,
      mixer: mixer,
      face: !!face,
      body: info.body || 'biped',
      weapon: function () { return stance },
      equip: function (kind, opts) {
        weapons.forEach(function (o) { if (o.parent) o.parent.remove(o) }); weapons = []
        stance = 'none'
        if (!kind || kind === 'none') { cur = null; return api }
        var Y = new T.Vector3(0, 1, 0), Z = new T.Vector3(0, 0, 1)
        var up = function (x, y, z) { return new T.Quaternion().setFromUnitVectors(Y, new T.Vector3(x, y, z).normalize()) }
        if (typeof kind === 'object' && kind.isObject3D) {   // 직접 만든 무기(GLB 등) — 오른손에, 무기의 +Y 가 앞위로
          attachTo(handR, kind, up(0, 0.7, 0.7)); weapons.push(kind); stance = (opts && opts.stance) || 'sword'; return api
        }
        if (kind === 'sword' || kind === 'sword_shield') { var sw = makeWeapon('sword'); attachTo(handR, sw, up(0, 0.75, 0.65), null, 'sword_idle'); weapons.push(sw) }
        if (kind === 'sword_shield') { var sh = makeWeapon('shield'); attachTo(handL, sh, new T.Quaternion(), new T.Vector3(0, 0, 0.05 * h), 'shield_block'); weapons.push(sh) }   // 막을 때 방패 면이 앞을 본다
        if (kind === 'greatsword') { var gs = makeWeapon('greatsword'); attachTo(handR, gs, up(0, 0.85, 0.5), null, 'greatsword_idle'); weapons.push(gs) }
        if (kind === 'gun') { var gn = makeWeapon('gun'); attachTo(handR, gn, new T.Quaternion(), null, 'gun_idle'); weapons.push(gn) }   // 겨눌 때 총구가 앞을 본다
        stance = kind
        return api
      },
      revive: function () { dead = false; if (oneAct) { oneAct.stop(); oneAct = null } cur = null },
      isDead: function () { return dead },
      say: function (sec) { talkLeft = Math.max(talkLeft, sec == null ? 1.6 : sec) },
      trigger: function (name) {
        if (name === 'talk') { api.say(1.6); return }
        if (dead) return
        if (name === 'attack' && stance === 'gun' && acts.gun_shoot) { fire(); name = state === 'kneel' && acts.gun_shoot_kneel ? 'gun_shoot_kneel' : 'gun_shoot' }
        if (name === 'shoot') { name = acts.gun_shoot ? (state === 'kneel' && acts.gun_shoot_kneel ? 'gun_shoot_kneel' : 'gun_shoot') : 'attack'; fire() }
        else if (name === 'attack' && stance === 'gun') fire()
        // 칼은 연속 공격마다 다른 베기 (내려베기 → 가로베기 → 찌르기), 양손검은 내려치기 ↔ 가로 휘두르기
        if (name === 'attack' && (stance === 'sword' || stance === 'sword_shield')) { var sc = ['sword_slash', 'sword_slash_side', 'sword_thrust'].filter(function (n) { return acts[n] }); if (sc.length) { name = sc[combo % sc.length]; combo++ } }
        if (name === 'attack' && stance === 'greatsword') { var gc = ['greatsword_slash', 'greatsword_side'].filter(function (n) { return acts[n] }); if (gc.length) { name = gc[combo % gc.length]; combo++ } }
        if (name === 'block') name = acts.shield_block ? 'shield_block' : 'hit'
        if (name === 'die') {
          dead = true; one = 'die'; oneT = 0
          var da = acts.die
          if (da) { if (oneAct) oneAct.stop(); da.reset().setLoop(T.LoopOnce, 1); da.clampWhenFinished = true; da.fadeIn(0.08).play(); if (cur) cur.fadeOut(0.1); cur = null; oneAct = da }
          return
        }
        one = name; oneT = 0
        var a = acts[name]
        if (a) { if (oneAct) oneAct.stop(); a.reset().setLoop(T.LoopOnce, 1); a.clampWhenFinished = false; a.setEffectiveWeight(1).fadeIn(0.06).play(); oneAct = a; if (cur) { cur.fadeOut(0.08); cur = null } }
      },
      update: function (dt, st) {
        dt = Math.min(0.1, dt || 0.016); t += dt
        if (st) state = st
        var air = state === 'jump' || state === 'fall'
        if (prevAir && !air) api.trigger('land')
        if (!prevAir && state === 'jump' && acts.jump_start) api.trigger('jump_start')
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
        } else if (state === 'talk' || talkLeft > 0) {
          tg.rx = Math.sin(t * 9) * 0.04; tg.ry = Math.sin(t * 2) * 0.1; tg.sy = 1 + Math.sin(t * 9) * 0.015
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
        if (dead) { for (var dk in s) s[dk] = lerp(s[dk], dk === 'sx' || dk === 'sy' ? 1 : 0, r) }
        inner.position.set(0, baseY + s.y * amp, s.z * amp)
        inner.rotation.set(s.rx * amp, s.ry, s.rz * amp)
        inner.scale.set(lerp(1, s.sx, amp), lerp(1, s.sy, amp), lerp(1, s.sx, amp))
        for (var i = 0; i < mats.length; i++) mats[i].emissive.setRGB(flash * 0.9, flash * 0.1, flash * 0.1)
        // 얼굴: 눈 깜박 + 입
        if (talkLeft > 0) talkLeft -= dt
        var talking = state === 'talk' || talkLeft > 0
        if (face) {
          face.nextBlink -= dt
          if (face.nextBlink <= 0) { face.blinkT = 0.14; face.nextBlink = 2 + Math.random() * 3.5 }
          if (face.blinkT > 0) face.blinkT -= dt
          var eyesShut = face.blinkT > 0 || one === 'hit'
          var mouthOpen = (talking && Math.sin(t * 22) > -0.2) || one === 'attack' || one === 'happy' || one === 'hit'
          var tx = eyesShut && mouthOpen ? (face.alt.both || face.alt.blink) : eyesShut ? face.alt.blink : mouthOpen ? face.alt.mouth : face.base
          if (tx !== face.cur) { face.mesh.material.map = tx; face.mesh.material.needsUpdate = true; face.cur = tx }
        }
        // 총알·불꽃
        for (var bi = bullets.length - 1; bi >= 0; bi--) {
          var bu = bullets[bi]; bu.life -= dt
          if (bu.v) bu.m.position.addScaledVector(bu.v, dt)
          else if (bu.m.material) { bu.m.material.opacity = Math.max(0, bu.life / 0.07); bu.m.scale.setScalar(1 + (0.07 - bu.life) * 12) }
          if (bu.life <= 0) { if (bu.m.parent) bu.m.parent.remove(bu.m); bu.m.geometry.dispose(); bu.m.material.dispose(); bullets.splice(bi, 1) }
        }
        if (mixer) {
          if (!dead) {
            var base = state
            if ((state === 'idle' || state === 'aim') && STANCE_IDLE[stance] && acts[STANCE_IDLE[stance]]) base = STANCE_IDLE[stance]
            if (state === 'kneel') base = stance === 'gun' && acts.gun_aim_kneel ? 'gun_aim_kneel' : acts.sit ? 'sit' : 'idle'
            if (oneAct && !oneAct.isRunning()) { oneAct.fadeOut(0.15); oneAct = null }
            if (!oneAct) play(talking && acts.talk && stance === 'none' ? 'talk' : base)   // 한 번 동작 중엔 기본 동작을 잠시 끈다
          }
          mixer.update(dt)
        }
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
