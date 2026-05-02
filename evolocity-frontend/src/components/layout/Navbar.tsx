import { NavLink } from "react-router-dom"
import { useTelemetry } from "../../context/TelemetryContext"

const links = [
  { to: "/",             label: "Dashboard"    },
  { to: "/teams",        label: "Teams"        },
  { to: "/competitions", label: "Competitions" },
  { to: "/leaderboard",  label: "Leaderboard"  },
  { to: "/alerts",       label: "Alerts"       },
]

export default function Navbar() {
  const { connected } = useTelemetry()

  return (
    <header className="w-full bg-ev-panel border-b border-ev-border px-6 py-3 flex items-center gap-8 shrink-0">
      {/* Brand */}
      <div className="shrink-0">
        <span className="text-ev-cyan font-bold text-base tracking-wide">EVolocity</span>
        <span className="text-slate-500 text-xs ml-2">Telemetry</span>
      </div>

      {/* Nav links */}
      <nav className="flex items-center gap-1 flex-1">
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              [
                "px-3 py-1.5 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-ev-cyan/10 text-ev-cyan font-medium"
                  : "text-slate-400 hover:text-white hover:bg-white/5",
              ].join(" ")
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Connection status */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-500"}`} />
        <span className="text-xs text-slate-400">{connected ? "Connected" : "Disconnected"}</span>
      </div>
    </header>
  )
}
