import { NavLink } from "react-router-dom"
import { useTelemetry } from "../../context/TelemetryContext"
import logo from "../../assets/logo.png"

const links = [
  { to: "/",             label: "Dashboard"    },
  { to: "/competitions", label: "Competitions" },
  { to: "/leaderboard",  label: "Leaderboard"  },
  { to: "/alerts",       label: "Alerts"       },
]

export default function Navbar() {
  const { connected } = useTelemetry()

  return (
    <header className="w-full bg-ev-cyan px-6 py-3 flex items-center gap-8 shrink-0">
      {/* Brand */}
      <img src={logo} alt="EVolocity" className="h-7 shrink-0" />

      {/* Nav links */}
      <nav className="flex items-center gap-1 flex-1">
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              [
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-ev-blue text-white"
                  : "text-white/70 hover:text-white hover:bg-white/15",
              ].join(" ")
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Connection status */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-300" : "bg-red-300"}`} />
        <span className="text-xs text-white/70">{connected ? "Connected" : "Disconnected"}</span>
      </div>
    </header>
  )
}
