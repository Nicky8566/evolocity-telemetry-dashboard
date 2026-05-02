interface Props {
  label:      string
  value:      string | number | null
  unit:       string
  highlight?: boolean   // red tint when penalty is active
}

export default function StatCard({ label, value, unit, highlight = false }: Props) {
  return (
    <div
      className={[
        "rounded-xl border p-4 flex flex-col gap-1",
        highlight
          ? "border-red-500/50 bg-red-950/20"
          : "border-ev-border bg-ev-panel",
      ].join(" ")}
    >
      <p className="text-xs text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums text-white">
          {value ?? "—"}
        </span>
        {value != null && (
          <span className="text-slate-400 text-sm">{unit}</span>
        )}
      </div>
    </div>
  )
}
