import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { ECUFrame } from "../../types"

interface Props {
  title:      string
  data:       ECUFrame[]
  dataKey:    "avg_voltage" | "avg_current" | "avg_power"
  color:      string
  unit:       string
  domain:     [number, number]
  showBrush?: boolean
}

// Formats a timestamp_ms value for the x-axis label.
// Small values (< 24 h) are device uptime — display as elapsed h:mm:ss.
// Large values are epoch ms (simulator) — display as local wall-clock time.
function fmtTime(ms: number): string {
  if (ms < 86_400_000) {
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor((ms % 3_600_000) / 60_000)
    const s = Math.floor((ms % 60_000) / 1_000)
    const mm = String(m).padStart(2, "0")
    const ss = String(s).padStart(2, "0")
    return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
  }
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export default function ChartCard({ title, data, dataKey, color, unit, domain, showBrush }: Props) {
  return (
    <div
      className="bg-ev-panel border border-ev-border rounded-xl p-5 shadow-sm"
      style={{ borderTopColor: color, borderTopWidth: 2 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <p className="text-xs uppercase tracking-widest font-semibold" style={{ color }}>{title}</p>
      </div>
      <ResponsiveContainer width="100%" height={showBrush ? 260 : 220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="timestamp_ms"
            type="number"
            scale="linear"
            domain={["dataMin", "dataMax"]}
            tickFormatter={fmtTime}
            minTickGap={30}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
          />
          <YAxis
            domain={domain}
            width={48}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickFormatter={(v) => `${v}${unit}`}
          />
          <Tooltip
            contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            labelStyle={{ color: "#64748b" }}
            formatter={(v) => [`${Number(v).toFixed(2)} ${unit}`, title]}
            labelFormatter={(ms) => fmtTime(ms as number)}
          />
          <Line
            type="linear"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {showBrush && (
            <Brush
              dataKey="timestamp_ms"
              tickFormatter={fmtTime}
              height={28}
              stroke="#000"
              fill="#f8fafc"
              travellerWidth={6}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
