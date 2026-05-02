interface Props {
  label:       string
  value:       string | number | null
  unit:        string
  highlight?:  boolean
  accentClass?: string
}

export default function StatCard({ label, value, unit, highlight = false, accentClass }: Props) {
  return (
    <div className={`rounded-xl border-t-2 border p-4 flex flex-col gap-1 bg-ev-panel shadow-sm ${highlight ? "border-red-300 border-t-red-400 bg-red-50" : `border-ev-border ${accentClass ?? "border-t-ev-border"}`}`}>
      <p className="text-xs text-slate-500 uppercase tracking-widest">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-3xl font-bold tabular-nums ${highlight ? "text-red-500" : "text-slate-900"}`}>
          {value ?? "—"}
        </span>
        {value != null && (
          <span className="text-slate-400 text-sm">{unit}</span>
        )}
      </div>
    </div>
  )
}
