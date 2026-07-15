export default function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border border-gray-800 bg-[#111] p-5">
      <p className="font-pixel text-[9px] text-gray-500 tracking-widest mb-2">{label}</p>
      <p className="text-2xl text-[#00ff41] font-pixel">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-[10px] text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}
