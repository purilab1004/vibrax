export default function StatCard({ label, value, sub, accent = '#2563eb' }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-[#ebe4d6] bg-white p-5 shadow-[0_1px_2px_rgba(36,31,23,0.04),0_8px_24px_-16px_rgba(36,31,23,0.18)]">
      <p className="text-[12px] font-semibold text-[#857a68] tracking-wide mb-2">{label}</p>
      <p className="text-[26px] leading-none font-extrabold tracking-tight" style={{ color: accent }}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-[11.5px] text-[#9d9280] mt-2">{sub}</p>}
    </div>
  )
}
