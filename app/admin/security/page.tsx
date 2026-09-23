'use client'
// 보안 · 서버 현황 — 트래픽/에러/LLM 시간대별, 이상 트래픽, 보안 이벤트, 웹훅 실패, 코인 원장(해시체인) 무결성, 보안 모듈 체크리스트
import AutoPanel from '@/components/admin/AutoPanel'
import { useCallback, useEffect, useState } from 'react'
import StatCard from '@/components/admin/StatCard'
import TrendChart from '@/components/admin/TrendChart'
import { PageHeader, Card, Badge, SectionTitle, Skeleton, btn, th, td, trHover } from '@/components/admin/ui'

interface Block { height: number; prev_hash: string | null; merkle_root: string; from_seq: number; to_seq: number; tx_count: number; block_hash: string; sealed_at: string }
interface Data { blocks: Block[]; hours: { h: string; pv: number; sessions: number; errors: number; llm: number }[]; totals: { pv24: number; sessions24: number; errors24: number; errorRate: number; llm24: number; llmCost24: number; webhookFail7: number; webhook7: number; secHigh7: number; sec7: number; suspiciousSessions: number; topIps: { ip_hash: string; pv: number; suspicious: boolean }[] }; security: { id: string; kind: string; severity: string; ip_hash: string | null; user_id: string | null; path: string | null; detail: unknown; created_at: string }[]; ledger: { count: number; brokenAt: number | null; available: boolean; last: { seq: number; hash: string; created_at: string } | null }; modules: Record<string, boolean> }
const KIND: Record<string, string> = { webhook_bad_signature: '웹훅 서명 위조 시도', webhook_bad_ip: '웹훅 비허용 IP', admin_action: '관리자 조치', rate_limit: '요청 제한', suspicious_traffic: '이상 트래픽', auth: '인증' }
const MOD: Record<string, string> = { paddleWebhookIpAllowlist: '결제 웹훅 IP 허용목록(런타임)', paddleSignature: '결제 웹훅 HMAC 서명 검증', adminIpAllowlistMaintenance: '점검 모드 IP 허용목록(현재 공개)', rlsAllTables: '모든 테이블 RLS', serviceRoleServerOnly: 'Service Role 키 서버 전용', noPrivateKeysInApp: '앱 내 프라이빗 키·지갑 서명 모듈 없음(커스터디얼)', ipStoredHashedOnly: 'IP 원문 미저장(해시)' }

export default function AdminSecurityPage() {
  const [d, setD] = useState<Data | null>(null)
  const load = useCallback(async () => { const r = await fetch('/api/admin/security'); if (r.ok) setD(await r.json()) }, [])
  useEffect(() => { const t = setTimeout(load, 0); const iv = setInterval(load, 60_000); return () => { clearTimeout(t); clearInterval(iv) } }, [load])
  const header = <PageHeader title="보안 · 서버 현황" desc="최근 24시간 트래픽·에러·LLM 호출과 7일 보안 이벤트, 이상 트래픽, 결제 웹훅 실패, 게임 코인 원장(해시체인) 무결성을 한 화면에서. 1분마다 갱신." actions={<button onClick={load} className={btn.ghost}>새로고침</button>} />
  if (!d) return <div>{header}<Skeleton rows={6} /></div>
  const t = d.totals
  return (
    <div>
      {header}
      <AutoPanel module="security" />
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-3">
        <StatCard label="24h 페이지뷰" value={t.pv24} sub={`세션 ${t.sessions24}`} />
        <StatCard label="24h 에러" value={t.errors24} sub={`에러율 ${(t.errorRate * 100).toFixed(2)}%`} accent={t.errors24 > 50 ? '#dc2626' : '#1f2430'} />
        <StatCard label="24h LLM 호출" value={t.llm24} sub={`$${t.llmCost24.toFixed(2)}`} accent="#0891b2" />
        <StatCard label="웹훅 실패 (7일)" value={t.webhookFail7} sub={`전체 ${t.webhook7}`} accent={t.webhookFail7 ? '#dc2626' : '#059669'} />
        <StatCard label="보안 이벤트 HIGH (7일)" value={t.secHigh7} sub={`전체 ${t.sec7}`} accent={t.secHigh7 ? '#dc2626' : '#059669'} />
        <StatCard label="이상 세션" value={t.suspiciousSessions} sub="시간당 500 PV 이상" accent={t.suspiciousSessions ? '#f59e0b' : '#059669'} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-3">
        <TrendChart label="시간대별 페이지뷰 (24h)" values={d.hours.map(h => h.pv)} labels={d.hours.map(h => h.h)} />
        <TrendChart label="시간대별 에러" values={d.hours.map(h => h.errors)} labels={d.hours.map(h => h.h)} color="#dc2626" />
        <TrendChart label="시간대별 LLM 호출" values={d.hours.map(h => h.llm)} labels={d.hours.map(h => h.h)} color="#0891b2" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mb-3">
        <Card className="overflow-hidden xl:col-span-2">
          <SectionTitle right={<span>7일</span>}>보안 이벤트</SectionTitle>
          {d.security.length === 0 ? <p className="p-5 text-[13px] text-[#9aa1ad]">기록된 보안 이벤트가 없어요 (서명 실패·비허용 IP·관리자 조치 등이 여기 쌓입니다).</p> : (
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto"><table className="w-full">
              <thead><tr><th className={th}>시각</th><th className={th}>종류</th><th className={th}>심각도</th><th className={th}>IP(해시)</th><th className={th}>경로</th><th className={th}>상세</th></tr></thead>
              <tbody className="divide-y divide-[#eef0f4]">{d.security.map(s => (
                <tr key={s.id} className={trHover}><td className={`${td} whitespace-nowrap text-[#6b7280]`}>{new Date(s.created_at).toLocaleString()}</td><td className={td}>{KIND[s.kind] ?? s.kind}</td><td className={td}><Badge color={s.severity === 'high' ? '#dc2626' : s.severity === 'warn' ? '#f59e0b' : '#6b7280'}>{s.severity}</Badge></td><td className={`${td} font-mono text-[11px]`}>{s.ip_hash?.slice(0, 10) ?? '-'}</td><td className={`${td} font-mono text-[11px]`}>{s.path ?? '-'}</td><td className={`${td} text-[11px] text-[#6b7280] max-w-[260px] truncate`}>{s.detail ? JSON.stringify(s.detail) : ''}</td></tr>
              ))}</tbody></table></div>
          )}
        </Card>
        <div className="space-y-3">
          <Card className="p-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430] mb-2">게임 코인 원장 (해시체인)</p>
            {!d.ledger.available ? <p className="text-[12.5px] text-[#6b7280]">원장 테이블이 없어요. <code>db/migrations/2026-08-19-chain-and-security.sql</code> 실행 후 vcoin 변동이 체인으로 기록돼요.</p> : (
              <>
                <div className="flex items-center gap-2"><Badge color={d.ledger.brokenAt == null ? '#059669' : '#dc2626'}>{d.ledger.brokenAt == null ? '무결성 정상' : `체인 훼손 seq #${d.ledger.brokenAt}`}</Badge><span className="text-[12px] text-[#6b7280]">엔트리 {d.ledger.count.toLocaleString()}</span></div>
                {d.ledger.last && <p className="mt-2 text-[11px] text-[#6b7280] break-all">최근 #{d.ledger.last.seq} · {new Date(d.ledger.last.created_at).toLocaleString()}<br /><span className="font-mono">{d.ledger.last.hash}</span></p>}
                <p className="mt-2 text-[11.5px] text-[#9aa1ad]">각 코인 변동이 이전 해시를 포함해 SHA-256 으로 연결됩니다(변조 시 즉시 감지). 상장 준비 단계에서 이 해시를 주기적으로 온체인에 앵커링하고 스냅샷 기준으로 토큰을 배분할 수 있어요.</p>
              </>
            )}
          </Card>
          <Card className="p-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430] mb-2">보안 모듈 체크리스트</p>
            <ul className="space-y-1.5">{Object.entries(d.modules).map(([k, v]) => <li key={k} className="flex items-center gap-2 text-[12.5px]"><span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${v ? 'bg-emerald-100 text-emerald-700' : 'bg-[#eef0f4] text-[#6b7280]'}`}>{v ? '✓' : '·'}</span><span className={v ? 'text-[#1f2430]' : 'text-[#6b7280]'}>{MOD[k] ?? k}</span></li>)}</ul>
          </Card>
          <Card className="p-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430] mb-2">상위 트래픽 IP (해시)</p>
            <ul className="space-y-1">{t.topIps.map(i => <li key={i.ip_hash} className="flex items-center justify-between text-[12px]"><span className="font-mono">{i.ip_hash.slice(0, 12)}</span><span className={i.suspicious ? 'text-[#dc2626] font-bold' : 'text-[#6b7280]'}>{i.pv} PV{i.suspicious ? ' · 의심' : ''}</span></li>)}{t.topIps.length === 0 && <li className="text-[12px] text-[#9aa1ad]">데이터 없음</li>}</ul>
          </Card>
        </div>
      </div>
      {/* Vibrex Chain — 블록 탐색기 */}
      <Card className="overflow-hidden mt-3">
        <SectionTitle right={<button onClick={async () => { const r = await fetch('/api/admin/security', { method: 'POST' }); const j = await r.json(); alert(r.ok ? (j.height ? `블록 #${j.height} 봉인 완료` : '봉인할 새 트랜잭션이 없어요') : j.error); load() }} className={btn.primary + ' !h-7'}>블록 봉인</button>}>Vibrex Chain · 블록 탐색기 (v1 · 단일 노드 PoA)</SectionTitle>
        {(d.blocks ?? []).length === 0 ? <p className="p-5 text-[13px] text-[#9aa1ad]">아직 봉인된 블록이 없어요. 원장에 트랜잭션이 쌓이면 "블록 봉인"으로 첫 블록(#1)을 만들 수 있어요.</p> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr><th className={th}>높이</th><th className={th}>봉인 시각</th><th className={`${th} text-right`}>트랜잭션</th><th className={th}>범위(seq)</th><th className={th}>블록 해시</th><th className={th}>이전 해시</th></tr></thead>
            <tbody className="divide-y divide-[#eef0f4]">{d.blocks.map(b => (
              <tr key={b.height} className={trHover}><td className={`${td} font-bold`}>#{b.height}</td><td className={`${td} whitespace-nowrap text-[#6b7280]`}>{new Date(b.sealed_at).toLocaleString()}</td><td className={`${td} text-right tabular-nums`}>{b.tx_count}</td><td className={`${td} font-mono text-[11px]`}>{b.from_seq}–{b.to_seq}</td><td className={`${td} font-mono text-[11px] text-[#2563eb]`}>{b.block_hash.slice(0, 20)}…</td><td className={`${td} font-mono text-[11px] text-[#9aa1ad]`}>{b.prev_hash ? b.prev_hash.slice(0, 20) + '…' : 'genesis'}</td></tr>
            ))}</tbody></table></div>
        )}
      </Card>
    </div>
  )
}
