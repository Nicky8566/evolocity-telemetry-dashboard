import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { Point } from "../../types"

interface Props {
  title:   string
  data:    Point[]
  dataKey: "voltage" | "current"
  color:   string
  unit:    string
  domain:  [number, number]
}

export default function ChartCard({ title, data, dataKey, color, unit, domain }: Props) {
  return (
    <div className="bg-ev-panel border border-ev-border rounded-xl p-5">
      <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="timeMs"
            tickFormatter={(v) => `${(v / 1000).toFixed(1)}s`}
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
            contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(v) => [`${Number(v).toFixed(2)} ${unit}`, title]}
            labelFormatter={(l) => `Time: ${(Number(l) / 1000).toFixed(2)}s`}
          />
          <Line
            type="linear"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
