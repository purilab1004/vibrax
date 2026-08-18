export default function StatCard({ label, value, sub, accent = '#1f2430' }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-[#e3e6ec] bg-white px-4 py-3">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#6b7280] mb-1.5">{label}</p>
      <p className="text-[22px] leading-none font-bold tracking-tight" style={{ color: accent }}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-[11px] text-[#9aa1ad] mt-1.5">{sub}</p>}
    </div>
  )
}
