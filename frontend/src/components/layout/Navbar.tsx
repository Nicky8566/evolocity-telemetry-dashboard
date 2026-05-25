import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useTelemetry } from "../../context/TelemetryContext";
import { teamsApi } from "../../api/teams";
import type { Alert, Team } from "../../types";
import logo from "../../assets/logo.png";

const links = [
  { to: "/",            label: "Competitions" },
  { to: "/teams",       label: "Teams" },
  { to: "/esps",        label: "ESPs" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/alerts",      label: "Alerts" },
];

const TOAST_DURATION = 5000;

function NavToast({ alert, teams }: { alert: Alert; teams: Team[] }) {
  const team      = teams.find((t) => t.ecu_serial === alert.ecu_serial);
  const isPenalty = alert.type === "penalty";
  const metric    = alert.metric ?? "power";
  const unit      = metric === "current" ? "A" : "W";
  const label     = metric === "current" ? "current" : "power";

  return (
    <div
      className={`nav-toast-enter flex flex-col gap-0.5 px-3 py-1.5 rounded-lg border bg-white text-xs ${
        isPenalty ? "border-red-400" : "border-amber-400"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-900 font-semibold truncate">
          {team ? (
            <>{team.team_name} <span className="font-normal text-[10px] text-slate-400">· ESP-{alert.ecu_serial}</span></>
          ) : (
            `ESP-${alert.ecu_serial}`
          )}
        </span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
          isPenalty ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
        }`}>
          {isPenalty ? "PENALTY" : "WARNING"}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-sm font-bold tabular-nums ${isPenalty ? "text-red-500" : "text-amber-500"}`}>
          {alert.power_value.toFixed(metric === "current" ? 1 : 0)}{unit}
        </span>
        <span className="text-[10px] text-slate-500">
          exceeded {alert.threshold}{unit} {label} limit
        </span>
      </div>
    </div>
  );
}

export default function Navbar() {
  const { alerts } = useTelemetry();
  const [teams, setTeams] = useState<Team[]>([]);
  const seenRef = useRef(new Map<number, string>());
  const [visible, setVisible] = useState<Alert | null>(null);
  const timerRef = useRef<number>(0);

  useEffect(() => {
    teamsApi.list().then(({ data }) => setTeams(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (alerts.length === 0) return;

    if (seenRef.current.size === 0) {
      alerts.forEach((a) => seenRef.current.set(a.id, a.type));
      return;
    }

    let toShow: Alert | null = null;

    for (const alert of alerts) {
      const prev = seenRef.current.get(alert.id);
      if (prev === undefined) {
        toShow = alert;
        break;
      }
      if (prev !== alert.type) {
        toShow = alert;
        break;
      }
    }

    alerts.forEach((a) => seenRef.current.set(a.id, a.type));
    if (!toShow) return;

    setVisible(toShow);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setVisible(null), TOAST_DURATION);
  }, [alerts]);

  useEffect(() => {
    return () => window.clearTimeout(timerRef.current);
  }, []);

  return (
    <header className="w-full bg-ev-cyan px-6 py-4 flex items-center gap-8 shrink-0 sticky top-0 z-50">
      <img src={logo} alt="EVolocity" className="h-7 shrink-0" />

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

      <div className="relative shrink-0">
        {visible && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-64 z-[60]">
            <NavToast alert={visible} teams={teams} />
          </div>
        )}
      </div>
    </header>
  );
}
