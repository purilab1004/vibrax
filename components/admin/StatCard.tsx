export default function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border border-[#ebe4d6] bg-[#ffffff] p-5">
      <p className="font-pixel text-[11px] text-[#857a68] tracking-widest mb-2">{label}</p>
      <p className="text-3xl text-[#0284c7] font-pixel">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-[#9d9280] mt-1">{sub}</p>}
    </div>
  )
}
