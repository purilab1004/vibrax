// lib/jeumto/markup.js — 에디터 DOM (jeumto/index.html 의 #app 내부). editor.js 가 id 로 찾는다.
export const EDITOR_HTML = `
<div id="app">
  <aside id="panel">
    <header>
      <h1 id="title">점토</h1>
      <span class="sub">clay avatar editor</span><span class="stats" id="stats"></span>
    </header>

    <section>
      <h2>모드</h2>
      <div class="seg" id="mode-seg">
        <button type="button" data-mode="sculpt" class="active">빚기</button>
        <button type="button" data-mode="paint">칠하기</button>
        <button type="button" data-mode="place">붙이기</button>
      </div>
      <label class="check"><input type="checkbox" id="symmetry" /> 좌우 대칭 (빚기·칠하기·붙이기 공통)</label>
      <div class="row"><button type="button" id="set-front" title="지금 보고 있는 면을 캐릭터의 정면으로 삼아요 (가장 가까운 면으로 맞춤)">지금 보는 방향을 정면으로</button></div>
    </section>

    <section id="sculpt-section">
      <h2>브러시</h2>
      <div class="seg" id="brush-seg">
        <button type="button" data-brush="push" class="active">누르기</button>
        <button type="button" data-brush="pull">당기기</button>
        <button type="button" data-brush="inflate">부풀리기</button>
        <button type="button" data-brush="smooth">문지르기</button>
      </div>
      <label>반경 <input type="range" id="brush-size" min="0.1" max="1.2" step="0.02" value="0.45" /></label>
      <label>세기 <input type="range" id="brush-strength" min="0.1" max="1" step="0.05" value="0.5" /></label>
      <div class="row">
        <button type="button" id="undo" title="Ctrl+Z">↶ 되돌리기</button>
        <button type="button" id="redo" title="Ctrl+Shift+Z">↷ 다시</button>
        <button type="button" id="reset-clay">초기화</button>
      </div>
    </section>

    <section id="paint-section">
      <h2>점토 색</h2>
      <div class="swatches" id="clay-swatches"></div>
      <label>직접 선택 <input type="color" id="clay-color" value="#e8a3a0" /></label>
      <p class="hint">점토 전체의 기본 색. 붓으로 칠한 부분은 유지돼요.</p>
      <h2 style="margin-top:14px">붓</h2>
      <div class="swatches" id="paint-swatches"></div>
      <label>붓 색 <input type="color" id="paint-color" value="#ffffff" /></label>
      <label>반경 <input type="range" id="paint-size" min="0.05" max="1" step="0.01" value="0.25" /></label>
      <label>세기 <input type="range" id="paint-flow" min="0.1" max="1" step="0.05" value="0.6" /></label>
      <div class="row">
        <button type="button" id="paint-undo" title="Ctrl+Z">↶ 되돌리기</button>
        <button type="button" id="paint-redo" title="Ctrl+Shift+Z">↷ 다시</button>
        <button type="button" id="clear-paint">칠 모두 지우기</button>
      </div>
    </section>

    <section id="parts-section">
      <h2>파츠</h2>
      <div class="tabs" id="part-tabs"></div>
      <div class="grid" id="part-grid"></div>
      <label>파츠 색 <input type="color" id="part-color" value="#2b2b2b" /></label>
      <label>크기 <input type="range" id="part-scale" min="0.5" max="2" step="0.05" value="1" /></label>
      <label>회전 <input type="range" id="part-rotation" min="-180" max="180" step="5" value="0" /><span class="val" id="part-rotation-val">0°</span></label>
      <p class="hint">점토 클릭 = 붙이기 · 붙은 파츠 클릭 = 선택(스타일/색/크기 변경이 그 파츠에 적용) · 드래그 = 이동 · Delete = 삭제 · Esc = 선택 해제</p>
      <div class="row">
        <button type="button" id="delete-part" disabled>선택 파츠 삭제</button>
        <button type="button" id="clear-parts">파츠 모두 지우기</button>
      </div>
    </section>

    <section>
      <h2>캐릭터</h2>
      <label>이름 <input type="text" id="char-name" value="내 점토" maxlength="24" /></label>
      <label>목소리
        <select id="voice"><option value="female">여성</option><option value="male">남성</option></select>
      </label>
      <p class="hint">게임 방송 BJ로 나올 때 쓰는 TTS 목소리예요. 입(mouth)·눈(eye)을 붙여야 말하기/깜빡임이 동작해요.</p>
      <div class="row">
        <button type="button" id="revert-saved" disabled title="마지막으로 저장한 상태로 되돌리기">↩ 저장본으로</button>
        <button type="button" id="new-char">⟲ 처음으로 (기본 점토)</button>
      </div>
      <div class="row">
        <button type="button" id="talk-test">말하기 테스트</button>
      </div>
      <div class="row">
        <button type="button" id="download-json">JSON 내려받기</button>
        <button type="button" id="download-png">PNG 내려받기</button>
        <label class="file-btn">JSON 불러오기<input type="file" id="load-json" accept="application/json" hidden /></label>
      </div>
    </section>
  </aside>
  <main id="viewport">
    <canvas id="c"></canvas>
    <button type="button" id="panel-toggle" title="사이드 메뉴 접기/펼치기 (H)">◀</button>
    <div id="hud-top"><span id="mode-hint"></span></div>
    <div id="hud"><span>빈 곳 드래그 · 오른쪽 드래그 — 회전</span><span>휠 — 확대/축소</span><span>빈 곳 더블클릭 — 시점 초기화</span><span>단축키 1 빚기 · 2 칠하기 · 3 붙이기 · [ ] 반경 · ⌘Z 되돌리기 · H 메뉴 접기</span></div>
    <div id="toast"></div>
  </main>
</div>`
