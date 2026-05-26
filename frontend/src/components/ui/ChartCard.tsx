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

// Absolute time-of-day for primary x-axis tick: HH:mm:ss.d UTC
function fmtTime(ms: number): string {
  const d  = new Date(ms)
  const hh = String(d.getUTCHours()).padStart(2, "0")
  const mm = String(d.getUTCMinutes()).padStart(2, "0")
  const ss = String(d.getUTCSeconds()).padStart(2, "0")
  const ds = Math.floor(d.getUTCMilliseconds() / 100)
  return `${hh}:${mm}:${ss}.${ds}`
}

// Relative elapsed time from session start: MM:SS.d or H:MM:SS
function fmtRelative(elapsedMs: number): string {
  const abs = Math.max(0, elapsedMs)
  const h   = Math.floor(abs / 3_600_000)
  const m   = Math.floor((abs % 3_600_000) / 60_000)
  const s   = Math.floor((abs % 60_000) / 1_000)
  const ds  = Math.floor((abs % 1_000) / 100)
  const mm  = String(m).padStart(2, "0")
  const ss  = String(s).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}.${ds}`
}

// Custom XAxis tick: time-of-day on top, relative time from first frame below.
function makeXTick(originMs: number) {
  return function XTick({
    x,
    y,
    payload,
  }: {
    x?: number | string
    y?: number | string
    payload?: { value: number }
  }) {
    if (!payload) return null
    const tickX = Number(x ?? 0)
    const tickY = Number(y ?? 0)
    const ms    = payload.value
    return (
      <g transform={`translate(${tickX},${tickY})`}>
        <text textAnchor="middle" fill="#94a3b8" fontSize={11} y={4}>{fmtTime(ms)}</text>
        <text textAnchor="middle" fill="#94a3b8" fontSize={9}  y={17} opacity={0.65}>{fmtRelative(ms - originMs)}</text>
      </g>
    )
  }
}

// Custom tooltip: clock time + relative offset, value with Δvalue, time since last frame.
function makeTooltip(
  data:      ECUFrame[],
  dataKey:   "avg_voltage" | "avg_current" | "avg_power",
  unit:      string,
  title:     string,
  color:     string,
  originMs:  number,
  precision: number,
) {
  return function CustomTooltip({
    active,
    payload,
  }: {
    active?:  boolean
    payload?: Array<{ payload: ECUFrame }>
  }) {
    if (!active || !payload?.length) return null
    const frame = payload[0].payload
    const value = frame[dataKey]
    if (value == null) return null

    const idx     = data.findIndex(f => f.timestamp_ms === frame.timestamp_ms)
    const prev    = idx > 0 ? data[idx - 1] : null
    const prevVal = prev && !prev.synthetic ? prev[dataKey] : null
    const delta   = prevVal != null ? value - prevVal : null
    const deltaMs = prev ? frame.timestamp_ms - prev.timestamp_ms : null

    const deltaColor = delta == null ? undefined : delta >= 0 ? "#22c55e" : "#ef4444"
    const sign       = delta != null && delta >= 0 ? "+" : ""

    return (
      <div style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: "8px 12px",
        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
        fontSize: 12,
        lineHeight: "1.7",
        minWidth: 160,
      }}>
        <p style={{ color: "#64748b", marginBottom: 1 }}>
          {fmtTime(frame.timestamp_ms)}{" "}
          <span style={{ opacity: 0.6 }}>{fmtRelative(frame.timestamp_ms - originMs)}</span>
        </p>
        <p style={{ color: "#0f172a", fontWeight: 600 }}>
          <span style={{ color }}>{title}:</span>{" "}
          {value.toFixed(precision)}&thinsp;{unit}
          {delta != null && (
            <span style={{ color: deltaColor, fontWeight: 500 }}>{" "}({sign}{delta.toFixed(precision)})</span>
          )}
        </p>
        {deltaMs != null && (
          <p style={{ color: "#94a3b8", fontSize: 11 }}>Since last: {deltaMs}&thinsp;ms</p>
        )}
      </div>
    )
  }
}

export default function ChartCard({ title, data, dataKey, color, unit, domain, showBrush }: Props) {
  const originMs  = data.length > 0 ? data[0].timestamp_ms : 0
  const precision = dataKey === "avg_power" ? 1 : 2

  const XTick        = useMemo(() => makeXTick(originMs), [originMs])
  const CustomTooltip = useMemo(
    () => makeTooltip(data, dataKey, unit, title, color, originMs, precision),
    [data, dataKey, unit, title, color, originMs, precision],
  )

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
          <Tooltip content={CustomTooltip} />
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
