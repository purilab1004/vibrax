'use client'
// 컨트롤러 관리 — 모든 게임 공통 조작 표준. PC 키보드 / 모바일 조이스틱·버튼을 그림으로 보여주고, 채널별 키·버튼을 편집한다.
// 저장하면 /play 서빙과 새 게임 저장 시 게임 HTML 에 반영(키 브리지·터치 버튼이 이 표를 읽는다).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader, Card, Badge, Skeleton, Toast, Toggle, btn, input, label as labelCls } from '@/components/admin/ui'
import { DEFAULT_CONTROLS, keyOfCode, type ControlChannel, type ControlGroup } from '@/lib/controls'

const GROUP_LABEL: Record<ControlGroup, string> = { move: '이동', main: '주 행동', item: '아이템 슬롯', legacy: '호환(옛 게임)' }
const GROUP_COLOR: Record<ControlGroup, string> = { move: '#0891b2', main: '#2563eb', item: '#d97706', legacy: '#6b7280' }
const KEYCAP: Record<string, string> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'SPACE', Enter: '⏎', ShiftLeft: 'SHIFT', Escape: 'ESC' }
const capOf = (code: string) => KEYCAP[code] ?? code.replace(/^Key|^Digit/, '')

export default function AdminControlsPage() {
  const [list, setList] = useState<ControlChannel[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [capture, setCapture] = useState<string | null>(null)   // 키 입력 대기 중인 채널 id
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)
  const say = (msg: string, kind: 'ok' | 'err' = 'ok') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 2600) }
  const load = useCallback(async () => { const r = await fetch('/api/admin/controls'); const j = await r.json(); if (r.ok) setList(j.channels) }, [])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])
  // 키 캡처 — "키 누르기" 상태에서 실제 키를 누르면 code 로 기록
  useEffect(() => {
    if (!capture) return
    const h = (e: KeyboardEvent) => { e.preventDefault(); if (e.code === 'Escape') { setCapture(null); return } setList(l => l && l.map(c => c.id === capture ? { ...c, pc: [e.code] } : c)); setCapture(null) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [capture])

  const save = async (reset = false) => {
    setSaving(true)
    const r = await fetch('/api/admin/controls', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reset ? { reset: true } : { channels: list }) })
    const j = await r.json().catch(() => ({})); setSaving(false)
    if (r.ok) { setList(j.channels); say(reset ? '기본값으로 되돌렸어요.' : '저장했어요. 새로 열리는 게임부터 적용돼요.') } else say(j.error ?? '저장 실패', 'err')
  }
  const patch = (id: string, p: Partial<ControlChannel>) => setList(l => l && l.map(c => c.id === id ? { ...c, ...p } : c))
  const add = () => {
    const id = prompt('새 채널 이름 (영문, 예: dash) — 게임의 VIBREX_GAME.inputs 키와 같아야 해요')?.trim()
    if (!id || !/^[a-zA-Z][a-zA-Z0-9]{0,23}$/.test(id)) return
    if (list?.some(c => c.id === id)) { say('이미 있는 채널이에요.', 'err'); return }
    setList(l => [...(l ?? []), { id, label: id, desc: '', pc: [], mobile: 'button', btnLabel: id.slice(0, 2).toUpperCase(), size: 'md', group: 'main', enabled: true }])
  }
  const remove = (id: string) => { if (DEFAULT_CONTROLS.some(c => c.id === id)) { say('기본 채널은 지울 수 없어요. 사용 안 함으로 끄세요.', 'err'); return } setList(l => l && l.filter(c => c.id !== id)) }
  const dirty = useMemo(() => JSON.stringify(list) !== JSON.stringify(DEFAULT_CONTROLS), [list])

  const header = <PageHeader title="컨트롤러 관리" desc="모든 게임이 따르는 조작 표준이에요. 게임은 조작을 '채널'(jump, fire…)로만 선언하고, PC 키와 모바일 버튼은 여기서 정한 대로 플랫폼이 자동으로 붙여요. 버튼을 추가하면 새 채널을 쓰는 게임부터 자동으로 나타나요."
    actions={<div className="flex items-center gap-2"><button onClick={add} className={btn.ghost}>＋ 채널 추가</button><button onClick={() => save(true)} className={btn.ghost} disabled={saving || !dirty}>기본값 복원</button><button onClick={() => save(false)} className={btn.primary} disabled={saving || !list}>{saving ? '저장 중…' : '저장'}</button></div>} />
  if (!list) return <div>{header}<Skeleton /></div>
  const active = list.filter(c => c.enabled)
  const byCode = (code: string) => active.find(c => c.group !== 'legacy' && c.pc.includes(code)) ?? active.find(c => c.pc.includes(code))
  const btnChannels = active.filter(c => c.mobile === 'button' && c.group !== 'legacy')
  const mainBtns = btnChannels.filter(c => c.group !== 'item'), itemBtns = btnChannels.filter(c => c.group === 'item')

  return (
    <div>
      {header}
      {/* ── 그림: PC 키보드 / 모바일 ── */}
      <div className="grid lg:grid-cols-2 gap-3 mb-3">
        <Card className="p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#6b7280] mb-3">PC · 키보드</p>
          <div className="rounded-xl bg-[#1b1f2a] p-4 text-white select-none">
            <div className="flex flex-col gap-3">
              {/* 숫자·문자 줄 */}
              <div className="flex gap-2 items-end">
                <div className="flex gap-1.5">{['Digit1', 'Digit2', 'Digit3', 'Digit4'].map(code => <Keycap key={code} code={code} ch={byCode(code)} />)}</div>
                <div className="flex gap-1.5 ml-4">{['KeyA', 'KeyS', 'KeyD'].map(code => <Keycap key={code} code={code} ch={byCode(code)} />)}</div>
                <div className="ml-auto grid grid-cols-3 gap-1.5">
                  <span /><Keycap code="ArrowUp" ch={byCode('ArrowUp')} /><span />
                  <Keycap code="ArrowLeft" ch={byCode('ArrowLeft')} /><Keycap code="ArrowDown" ch={byCode('ArrowDown')} /><Keycap code="ArrowRight" ch={byCode('ArrowRight')} />
                </div>
              </div>
              <div className="flex gap-1.5 items-end"><Keycap code="Space" ch={byCode('Space')} wide /></div>
            </div>
            <p className="text-[10.5px] text-white/50 mt-3">색 칸 = 채널이 매핑된 키. 점프가 없는 게임은 스페이스가 발사(fire)로 대신 들어가요.</p>
          </div>
          <ul className="mt-3 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-[#4b5563]">
            {active.filter(c => c.group !== 'legacy' && c.pc.length).map(c => <li key={c.id} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: GROUP_COLOR[c.group] }} /><b className="text-[#1f2430]">{c.pc.map(capOf).join(' / ')}</b><span>{c.label}</span><span className="text-[#9aa1ad] font-mono text-[11px]">{c.id}</span></li>)}
          </ul>
        </Card>
        <Card className="p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#6b7280] mb-3">모바일 · 터치</p>
          <div className="mx-auto w-full max-w-[420px] aspect-[16/9] rounded-2xl bg-[#1b1f2a] relative overflow-hidden select-none border-4 border-[#0f1219]">
            <div className="absolute inset-0 opacity-[.08] bg-[radial-gradient(circle_at_30%_40%,#fff,transparent_40%)]" />
            <span className="absolute top-2 left-3 text-[9px] text-white/50 tracking-widest">GAME</span>
            {/* 조이스틱 */}
            <div className="absolute left-4 bottom-4 w-[88px] h-[88px] rounded-full border border-white/35 bg-white/10 flex items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-white/60" />
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-white/70 whitespace-nowrap">MOVE ({active.filter(c => c.mobile === 'stick').map(c => c.id).join('·')})</span>
            </div>
            {/* 버튼 */}
            <div className="absolute right-4 bottom-4 flex flex-col items-end gap-2">
              {itemBtns.length > 0 && <div className="flex gap-1.5">{itemBtns.map(c => <MobileBtn key={c.id} c={c} />)}</div>}
              <div className="flex gap-2 items-end">{mainBtns.slice().reverse().map(c => <MobileBtn key={c.id} c={c} />)}</div>
            </div>
          </div>
          <p className="text-[11.5px] text-[#6b7280] mt-3">조이스틱은 왼쪽 아래(터치한 자리에서 뜸), 버튼은 오른쪽 아래. 게임이 선언한 채널의 버튼만 나타나요 — 예: 점프만 있는 러너는 JUMP 하나, 슈팅은 A(발사)·D(아이템).</p>
        </Card>
      </div>

      {/* ── 편집 표 ── */}
      <Card className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead><tr>{['채널', '이름 · 설명', '그룹', 'PC 키', '모바일', '버튼 글자', '크기', '사용', ''].map((h, i) => <th key={i} className="text-left text-[10.5px] font-semibold uppercase tracking-wide text-[#6b7280] px-3 py-2 bg-[#f7f8fa] border-b border-[#e3e6ec] whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {list.map(c => (
              <tr key={c.id} className={`border-b border-[#eef0f4] ${c.enabled ? '' : 'opacity-50'}`}>
                <td className="px-3 py-2 font-mono text-[12px] text-[#1f2430] whitespace-nowrap">{c.id}</td>
                <td className="px-3 py-2 min-w-[220px]"><input value={c.label} onChange={e => patch(c.id, { label: e.target.value })} className={`${input} mb-1`} /><input value={c.desc} onChange={e => patch(c.id, { desc: e.target.value })} placeholder="설명" className={`${input} text-[11.5px]`} /></td>
                <td className="px-3 py-2"><select value={c.group} onChange={e => patch(c.id, { group: e.target.value as ControlGroup })} className={input}>{(Object.keys(GROUP_LABEL) as ControlGroup[]).map(g => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}</select></td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    {c.pc.map(code => <kbd key={code} className="h-7 min-w-7 px-2 rounded-md border border-[#c5cad4] bg-[#f7f8fa] text-[12px] font-bold text-[#1f2430] inline-flex items-center justify-center">{capOf(code)}</kbd>)}
                    <button onClick={() => setCapture(capture === c.id ? null : c.id)} className={`h-7 px-2 rounded-md text-[11px] font-semibold border ${capture === c.id ? 'bg-[#2563eb] text-white border-[#2563eb] animate-pulse' : 'border-[#d9dde5] bg-white text-[#4b5563] hover:border-[#2563eb]'}`}>{capture === c.id ? '키를 누르세요…' : '키 바꾸기'}</button>
                    {c.pc.length > 0 && <button onClick={() => patch(c.id, { pc: [] })} className="text-[11px] text-[#9aa1ad] hover:text-[#dc2626]">지우기</button>}
                  </div>
                </td>
                <td className="px-3 py-2"><select value={c.mobile} onChange={e => patch(c.id, { mobile: e.target.value as ControlChannel['mobile'] })} className={input}><option value="stick">조이스틱</option><option value="button">버튼</option><option value="none">없음</option></select></td>
                <td className="px-3 py-2"><input value={c.btnLabel ?? ''} onChange={e => patch(c.id, { btnLabel: e.target.value.slice(0, 6) })} disabled={c.mobile !== 'button'} className={`${input} w-20 font-bold`} /></td>
                <td className="px-3 py-2"><select value={c.size ?? 'md'} onChange={e => patch(c.id, { size: e.target.value as ControlChannel['size'] })} disabled={c.mobile !== 'button'} className={input}><option value="lg">크게</option><option value="md">보통</option><option value="sm">작게</option></select></td>
                <td className="px-3 py-2"><Toggle checked={c.enabled} onChange={v => patch(c.id, { enabled: v })} /></td>
                <td className="px-3 py-2"><button onClick={() => remove(c.id)} className="text-[11px] text-[#9aa1ad] hover:text-[#dc2626]" title="기본 채널은 지울 수 없음">삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-[11.5px] text-[#6b7280] mt-3">키 이름은 브라우저의 <code className="bg-[#f3f5f8] px-1 rounded">KeyboardEvent.code</code> 기준이에요 (예: Space, KeyA, Digit1, ArrowDown). 같은 키를 여러 채널에 두면 표 위쪽 채널이 우선하고, 게임에 그 채널이 없으면 아래 채널로 넘어가요. 게임 코드는 채널 이름만 알면 되니 나중에 키를 바꿔도 게임을 다시 만들 필요가 없어요.</p>
      <Toast msg={toast?.msg ?? null} kind={toast?.kind ?? 'ok'} />
    </div>
  )
}

function Keycap({ code, ch, wide }: { code: string; ch?: ControlChannel; wide?: boolean }) {
  const on = !!ch
  return (
    <div className={`relative ${wide ? 'w-[260px]' : 'w-11'} h-11 rounded-md border flex flex-col items-center justify-center text-[12px] font-bold ${on ? 'border-transparent text-white' : 'border-white/15 bg-white/5 text-white/40'}`} style={on ? { background: GROUP_COLOR[ch!.group] } : undefined} title={ch ? `${ch.label} (${ch.id})` : keyOfCode(code)}>
      <span>{capOf(code)}</span>
      {ch && <span className="text-[9px] font-medium opacity-90 leading-none mt-0.5 truncate max-w-full px-1">{ch.label}</span>}
    </div>
  )
}
function MobileBtn({ c }: { c: ControlChannel }) {
  const sz = c.size === 'lg' ? 'w-14 h-14 text-[12px]' : c.size === 'sm' ? 'w-8 h-8 text-[10px]' : 'w-11 h-11 text-[11px]'
  return <div className={`${sz} rounded-full border border-white/35 bg-white/15 text-white font-extrabold flex items-center justify-center`} title={`${c.label} (${c.id})`}>{c.btnLabel || c.id.toUpperCase()}<Badge color={GROUP_COLOR[c.group]}>{''}</Badge></div>
}
