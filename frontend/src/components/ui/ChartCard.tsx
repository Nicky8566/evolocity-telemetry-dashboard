import { useMemo } from "react"
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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

// Formats timestamp_ms for the primary x-axis label.
// Uptime ms (< 24 h): elapsed h:mm:ss or mm:ss.d.
// Epoch ms (≥ 24 h): HH:mm:ss.d UTC (decisecond precision so 100 ms ticks are distinguishable).
function fmtTime(ms: number): string {
  if (ms < 86_400_000) {
    const h  = Math.floor(ms / 3_600_000)
    const m  = Math.floor((ms % 3_600_000) / 60_000)
    const s  = Math.floor((ms % 60_000) / 1_000)
    const ds = Math.floor((ms % 1_000) / 100)
    const mm = String(m).padStart(2, "0")
    const ss = String(s).padStart(2, "0")
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}.${ds}`
  }
  const d  = new Date(ms)
  const hh = String(d.getUTCHours()).padStart(2, "0")
  const mm = String(d.getUTCMinutes()).padStart(2, "0")
  const ss = String(d.getUTCSeconds()).padStart(2, "0")
  const ds = Math.floor(d.getUTCMilliseconds() / 100)
  return `${hh}:${mm}:${ss}.${ds}`
}

// Full ISO-style UTC date+time for x-axis sublabel, e.g. "2026-05-25 14:32:15 UTC".
function fmtUtcLabel(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19) + " UTC"
}

// Custom XAxis tick: time-of-day on top, full UTC date+time below.
// utcOffset = wall-clock epoch − device timestamp_ms (0 for epoch-ms devices).
function makeXTick(utcOffset: number) {
  return function XTick({
    x,
    y,
    payload,
  }: {
    x?: number | string
    y?: number | string
    payload?: { value: number }
  }) {
    const tickX = Number(x ?? 0)
    const tickY = Number(y ?? 0)
    if (!payload) return null
    const ms = payload.value
    return (
      <g transform={`translate(${tickX},${tickY})`}>
        <text textAnchor="middle" fill="#94a3b8" fontSize={11} y={4}>{fmtTime(ms)}</text>
        <text textAnchor="middle" fill="#94a3b8" fontSize={9}  y={17} opacity={0.65}>{fmtUtcLabel(ms + utcOffset)}</text>
      </g>
    )
  }
}
export default function ChartCard({ title, data, dataKey, color, unit, domain, showBrush }: Props) {
  const utcOffset = useMemo(() => {
    if (data.length === 0) return 0
    const f = data[0] as ECUFrame & { timestamp_ms: number }
    return new Date(f.timestamp).getTime() - f.timestamp_ms
  }, [data])
  const XTick = useMemo(() => makeXTick(utcOffset), [utcOffset])

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
            minTickGap={30}
            tick={XTick}
            height={36}
          />
          <YAxis
            domain={domain}
            width={48}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickFormatter={(v) => `${v}${unit}`}
          />
          {domain[0] < 0 && domain[1] > 0 && (
            <ReferenceLine
              y={0}
              stroke="#64748b"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={{ value: "0", position: "insideLeft", fill: "#64748b", fontSize: 11 }}
            />
          )}
          <Tooltip
            contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            labelStyle={{ color: "#64748b" }}
            formatter={(v) => [`${Number(v).toFixed(2)} ${unit}`, title]}
            labelFormatter={(ms) => {
              const t = ms as number
              return t >= 86_400_000
                ? fmtUtcLabel(t)
                : fmtTime(t)
            }}
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
