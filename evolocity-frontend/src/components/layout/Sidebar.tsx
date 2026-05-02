import { NavLink } from "react-router-dom"
import { useTelemetry } from "../../context/TelemetryContext"

const links = [
  { to: "/",             label: "Dashboard",    icon: "📡" },
  { to: "/teams",        label: "Teams",        icon: "🏁" },
  { to: "/competitions", label: "Competitions", icon: "🏆" },
  { to: "/leaderboard",  label: "Leaderboard",  icon: "⚡" },
  { to: "/alerts",       label: "Alerts",       icon: "🚨" },
]

export default function Sidebar() {
  const { connected } = useTelemetry()

  return (
    <aside className="flex flex-col w-56 min-h-screen bg-ev-panel border-r border-ev-border shrink-0">
      {/* Brand */}
      <div className="px-5 py-6 border-b border-ev-border">
        <h1 className="text-ev-cyan font-bold text-lg tracking-wide leading-tight">
          EVolocity
        </h1>
        <p className="text-slate-400 text-xs mt-0.5">Telemetry System</p>
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-ev-cyan/10 text-ev-cyan font-medium"
                  : "text-slate-400 hover:text-white hover:bg-white/5",
              ].join(" ")
            }
          >
            <span className="text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Connection status */}
      <div className="px-5 py-4 border-t border-ev-border">
        <div className="flex items-center gap-2">
          <span
            className={[
              "w-2 h-2 rounded-full",
              connected ? "bg-green-400" : "bg-red-500",
            ].join(" ")}
          />
          <span className="text-xs text-slate-400">
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>
    </aside>
  )
}
