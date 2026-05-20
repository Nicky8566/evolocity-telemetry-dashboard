import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { competitionsApi } from "../api/competitions";
import { ecuApi } from "../api/ecu";
import { teamsApi } from "../api/teams";
import AlertCard from "../components/ui/AlertCard";
import ChartCard from "../components/ui/ChartCard";
import ConfigureTeamModal from "../components/ui/ConfigureTeamModal";
import CreateTeamModal from "../components/ui/CreateTeamModal";
import StatCard from "../components/ui/StatCard";
import { useTelemetry } from "../context/TelemetryContext";
import type { CompetitionDetail, ECUFrame, Team } from "../types";
import ConfirmUnassignModal from "../components/ui/ConfirmUnassignModal";
import ExportMenu from "../components/ui/ExportMenu";
import RunControls from "../components/ui/RunControls";

const EVENT_COLOURS: Record<string, string> = {
  drag:       "bg-ev-cyan/10 text-ev-cyan border-ev-cyan/30",
  gymkhana:   "bg-purple-500/10 text-purple-400 border-purple-500/30",
  endurance:  "bg-ev-orange/10 text-ev-orange border-ev-orange/30",
  efficiency: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
};

const EVENT_LABELS: Record<string, string> = {
  drag:       "Drag Race",
  gymkhana:   "Gymkhana",
  endurance:  "Endurance",
  efficiency: "Efficiency",
};

const POWER_LIMIT_MIN     = 0;
const POWER_LIMIT_MAX     = 2500;
const POWER_LIMIT_PRESETS = [350, 2000];

function defaultPowerLimit(team: Team) {
  return team.power_limit ?? (team.vehicle_class.toLowerCase() === "standard" ? 350 : 2000);
}

export default function Dashboard() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { boardData, alerts } = useTelemetry();

  const [competition, setCompetition]         = useState<CompetitionDetail | null>(null);
  const [allTeams, setAllTeams]               = useState<Team[]>([]);
  const [registeredTeams, setRegisteredTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam]       = useState<Team | null>(null);
  const [showCreateTeam, setShowCreateTeam]   = useState(false);
  const [teamToUnassign, setTeamToUnassign]   = useState<Team | null>(null);
  const [configureTeam, setConfigureTeam]     = useState<Team | null>(null);

  const [powerLimitDraft, setPowerLimitDraft]     = useState(2000);
  const [dirtyPowerTeamId, setDirtyPowerTeamId]   = useState<number | null>(null);
  const [powerLimitStatus, setPowerLimitStatus]   = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [tab, setTab]                   = useState<"live" | "history">("live");
  const [historyFrames, setHistoryFrames] = useState<ECUFrame[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError]     = useState(false);
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");

  // Ref so loadTeams can read current selectedTeam without it being a dependency
  const selectedTeamRef = useRef(selectedTeam);
  useEffect(() => { selectedTeamRef.current = selectedTeam; }, [selectedTeam]);

  const loadTeams = useCallback(() => {
    if (id) {
      Promise.all([competitionsApi.getById(parseInt(id)), teamsApi.list()])
        .then(([{ data }, { data: teamRows }]) => {
          setCompetition(data);
          setAllTeams(data.teams);
          setRegisteredTeams(teamRows);
          const current = selectedTeamRef.current;
          if (data.teams.length > 0 && !current) {
            setSelectedTeam(data.teams[0]);
          } else if (current) {
            const refreshed = data.teams.find((t) => t.id === current.id);
            if (refreshed && (
              refreshed.ecu_serial  !== current.ecu_serial  ||
              refreshed.power_limit !== current.power_limit ||
              refreshed.team_name   !== current.team_name
            )) setSelectedTeam(refreshed);
          }
        })
        .catch(console.error);
    } else {
      teamsApi.list().then(({ data }) => {
        setAllTeams(data);
        setRegisteredTeams(data);
        const current = selectedTeamRef.current;
        if (current) {
          const refreshed = data.find((t) => t.id === current.id);
          if (refreshed && (
            refreshed.ecu_serial  !== current.ecu_serial  ||
            refreshed.power_limit !== current.power_limit ||
            refreshed.team_name   !== current.team_name
          )) setSelectedTeam(refreshed);
        }
      }).catch(console.error);
    }
  }, [id]);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  useEffect(() => {
    if (!selectedTeam) return;
    setPowerLimitDraft(defaultPowerLimit(selectedTeam));
    setDirtyPowerTeamId(null);
    setPowerLimitStatus("idle");
    setTab("live");
    setHistoryFrames([]);
    setHistoryError(false);
    setDateFrom("");
    setDateTo("");
  }, [selectedTeam?.id]);

  // Fetch history when tab switches — scoped to this team + when they joined this competition
  useEffect(() => {
    if (tab !== "history" || !selectedTeam?.ecu_serial) return;
    setHistoryLoading(true);
    setHistoryError(false);
    ecuApi
      .history({
        ecu_serial: selectedTeam.ecu_serial,
        from: selectedTeam.joined_at ?? competition?.created_at,
      })
      .then(({ data }) => setHistoryFrames(data))
      .catch(() => setHistoryError(true))
      .finally(() => setHistoryLoading(false));
  }, [tab, selectedTeam?.id, competition?.id]);

  useEffect(() => {
    if (!selectedTeam || dirtyPowerTeamId !== selectedTeam.id) return;
    setPowerLimitStatus("saving");
    const t = window.setTimeout(() => {
      teamsApi
        .updatePowerLimit(selectedTeam.id, powerLimitDraft)
        .then(() => { updateTeamPowerLimitInState(selectedTeam.id, powerLimitDraft); setPowerLimitStatus("saved"); })
        .catch(() => setPowerLimitStatus("error"));
    }, 250);
    return () => window.clearTimeout(t);
  }, [dirtyPowerTeamId, powerLimitDraft, selectedTeam?.id]);

  function handleUnassignTeam(team: Team) {
    if (!competition) return;
    competitionsApi.unassignTeam(competition.id, team.id).then(() => {
      if (selectedTeam?.id === team.id) setSelectedTeam(null);
      setTeamToUnassign(null);
      loadTeams();
    }).catch(console.error);
  }

  function updateTeamPowerLimitInState(teamId: number, powerLimit: number) {
    const up = (t: Team) => t.id === teamId ? { ...t, power_limit: powerLimit } : t;
    setAllTeams((p) => p.map(up));
    setCompetition((p) => p ? { ...p, teams: p.teams.map(up) } : p);
    setSelectedTeam((p) => p?.id === teamId ? up(p) : p);
  }

  function setPowerLimit(val: number) {
    const clamped = Math.max(POWER_LIMIT_MIN, Math.min(POWER_LIMIT_MAX, Math.round(val)));
    setPowerLimitDraft(clamped);
    setDirtyPowerTeamId(selectedTeam?.id ?? null);
  }

  const teams   = competition ? competition.teams : allTeams;
  const boardId = selectedTeam?.ecu_serial ? `ECU-${selectedTeam.ecu_serial}` : null;

  const liveFrames = useMemo(
    () => (boardId ? (boardData[boardId] ?? []) : []),
    [boardData, boardId],
  );

  const filteredLiveFrames = useMemo(() => {
    if (!dateFrom && !dateTo) return liveFrames;
    const from = dateFrom ? new Date(dateFrom).getTime() : 0;
    const to   = dateTo   ? new Date(dateTo).getTime()   : Infinity;
    return liveFrames.filter((f) => {
      const t = new Date(f.timestamp).getTime();
      return t >= from && t <= to;
    });
  }, [liveFrames, dateFrom, dateTo]);

  const displayFrames = tab === "live" ? filteredLiveFrames : historyFrames;
  const latestFrame   = displayFrames.at(-1) ?? null;

  const teamAlerts = useMemo(
    () => selectedTeam ? alerts.filter((a) => a.ecu_serial === selectedTeam.ecu_serial) : alerts,
    [alerts, selectedTeam],
  );
  const activePenalty = useMemo(
    () => teamAlerts.some((a) => a.type === "penalty" && a.ended_at === null),
    [teamAlerts],
  );

  const historySummary = useMemo(() => {
    if (!historyFrames.length) return null;
    const totalEnergy = historyFrames.reduce((s, f) => s + (f.avg_energy ?? 0), 0);
    const peakPower   = Math.max(...historyFrames.map((f) => f.avg_power ?? 0));
    return { totalEnergy, peakPower };
  }, [historyFrames]);

  return (
    <div className="flex gap-8 min-h-0 h-full">
      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-6 min-w-0 order-first">

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            {competition && (
              <button onClick={() => navigate("/")} className="text-xs text-slate-400 hover:text-ev-cyan transition-colors mb-1 block">
                ← Competitions
              </button>
            )}
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {competition ? competition.name : "Dashboard"}
              </h1>
              {competition && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {competition.event_types.map((evt) => (
                    <span key={evt} className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${EVENT_COLOURS[evt] ?? ""}`}>
                      {EVENT_LABELS[evt] ?? evt}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <p className="text-slate-400 text-sm mt-0.5">
              {selectedTeam
                ? `Viewing · ${selectedTeam.team_name} · ECU ${selectedTeam.ecu_serial ?? "unassigned"}`
                : "Select a team from the panel to view telemetry"}
            </p>
          </div>
        </div>

        {!selectedTeam ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 opacity-40 select-none">
            <p className="text-5xl">📡</p>
            <p className="text-slate-700 font-medium">No team selected</p>
            <p className="text-slate-400 text-sm">Pick a team from the panel on the right</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Voltage" value={latestFrame?.avg_voltage?.toFixed(2) ?? null} unit="V"  accentClass="border-t-ev-cyan" />
              <StatCard label="Current" value={latestFrame?.avg_current?.toFixed(2) ?? null} unit="A"  accentClass="border-t-ev-orange" />
              <StatCard label="Power"   value={latestFrame?.avg_power?.toFixed(1)   ?? null} unit="W"  highlight={activePenalty} accentClass="border-t-ev-blue" />
              <StatCard label="Energy"  value={latestFrame?.avg_energy?.toFixed(5)  ?? null} unit="Wh" accentClass="border-t-green-500" />
            </div>

            {/* Power limit */}
            <div className="bg-ev-panel border border-ev-border rounded-xl p-5 flex flex-col gap-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-ev-cyan uppercase tracking-widest font-semibold">Power Limit</p>
                  <p className="text-sm text-slate-500 mt-1">Alerts trigger when live power exceeds this team's limit.</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">{powerLimitDraft}W</p>
                  <p className={["text-xs", powerLimitStatus === "error" ? "text-red-500" : powerLimitStatus === "saving" ? "text-slate-400" : "text-slate-500"].join(" ")}>
                    {powerLimitStatus === "saving" ? "Saving..." : powerLimitStatus === "error" ? "Save failed" : "Applied to alert threshold"}
                  </p>
                </div>
              </div>
              <input type="range" min={POWER_LIMIT_MIN} max={POWER_LIMIT_MAX} step={10} value={powerLimitDraft} onChange={(e) => setPowerLimit(Number(e.target.value))} className="w-full accent-ev-orange" />
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{POWER_LIMIT_MIN}W</span>
                <span>{POWER_LIMIT_MAX}W</span>
              </div>
              <div className="flex gap-2">
                {POWER_LIMIT_PRESETS.map((p) => (
                  <button key={p} onClick={() => setPowerLimit(p)} className="px-3 py-2 rounded-lg border border-ev-border text-sm font-semibold text-slate-700 hover:border-ev-orange/50 hover:text-ev-orange transition-colors">
                    {p}W
                  </button>
                ))}
              </div>
            </div>

            {/* ── Graph box with internal tabs ─────────────────────── */}
            <div className="bg-ev-panel border border-ev-border rounded-xl shadow-sm overflow-hidden">

              {/* Tab bar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-ev-border">
                <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                  <button
                    onClick={() => setTab("live")}
                    className={["px-4 py-1.5 rounded-md text-sm font-medium transition-all", tab === "live" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"].join(" ")}
                  >
                    Live
                  </button>
                  <button
                    onClick={() => setTab("history")}
                    className={["px-4 py-1.5 rounded-md text-sm font-medium transition-all", tab === "history" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"].join(" ")}
                  >
                    History
                  </button>
                </div>

                {/* Controls — right side of tab bar */}
                {tab === "history" && selectedTeam && (
                  <ExportMenu
                    frames={historyFrames}
                    team={selectedTeam}
                    competition={competition}
                  />
                )}
                {tab === "live" && (
                  <div className="flex items-end gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-500">From</label>
                      <input type="datetime-local" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-white border border-ev-border rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-ev-cyan" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-500">To</label>
                      <input type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-white border border-ev-border rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-ev-cyan" />
                    </div>
                    {(dateFrom || dateTo) && (
                      <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="py-1.5 px-3 text-xs text-slate-400 hover:text-white border border-ev-border rounded-lg transition-colors">
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Chart content */}
              <div className="p-5 flex flex-col gap-4">
                {tab === "history" && historySummary && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 border border-ev-border rounded-xl p-4">
                      <p className="text-xs text-ev-cyan uppercase tracking-widest font-semibold mb-1">Total Energy</p>
                      <p className="text-2xl font-bold text-slate-900 tabular-nums">
                        {historySummary.totalEnergy.toFixed(4)} <span className="text-sm font-normal text-slate-400">Wh</span>
                      </p>
                    </div>
                    <div className="bg-slate-50 border border-ev-border rounded-xl p-4">
                      <p className="text-xs text-ev-cyan uppercase tracking-widest font-semibold mb-1">Peak Power</p>
                      <p className="text-2xl font-bold text-slate-900 tabular-nums">
                        {historySummary.peakPower.toFixed(1)} <span className="text-sm font-normal text-slate-400">W</span>
                      </p>
                    </div>
                  </div>
                )}

                {tab === "history" && historyLoading ? (
                  <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading history...</div>
                ) : tab === "history" && historyError ? (
                  <div className="flex items-center justify-center h-48 text-red-400 text-sm">Failed to load history — check your connection and try again.</div>
                ) : displayFrames.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-slate-400 text-sm opacity-40">
                    {tab === "live" ? "Waiting for live data..." : "No data for this team in this competition yet"}
                  </div>
                ) : (
                  <>
                    <ChartCard title="Voltage" data={displayFrames} dataKey="avg_voltage" color="#00a5c8" unit="V" domain={[0, 60]}             showBrush={tab === "history"} />
                    <ChartCard title="Current" data={displayFrames} dataKey="avg_current" color="#ec9c2c" unit="A" domain={[0, 10]}             showBrush={tab === "history"} />
                    <ChartCard title="Power"   data={displayFrames} dataKey="avg_power"   color="#6366f1" unit="W" domain={[0, POWER_LIMIT_MAX]} showBrush={tab === "history"} />
                  </>
                )}
              </div>
            </div>

            {/* Judge controls — both cards share a fixed height so the row stays aligned;
                Run Control gets most of the width since it has more controls. */}
            <div className="grid grid-cols-1 lg:grid-cols-[5fr_2fr] gap-3">
              {competition ? (
                <RunControls team={selectedTeam} competition={competition} />
              ) : (
                <div className="bg-ev-panel border border-ev-border rounded-xl p-5 text-sm text-slate-400 shadow-sm h-96">
                  Run Control is available when viewing a team inside a competition.
                </div>
              )}

              <div className="bg-ev-panel border border-ev-border rounded-xl p-5 flex flex-col gap-3 shadow-sm h-96 min-h-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-ev-cyan uppercase tracking-widest font-semibold">Events</p>
                  {teamAlerts.length > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">{teamAlerts.length}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0">
                  {teamAlerts.length === 0 ? (
                    <p className="text-slate-600 text-sm">No power breach events</p>
                  ) : (
                    teamAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} teams={teams} />)
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Team panel ───────────────────────────────────────────────── */}
      <aside className="w-48 shrink-0 flex flex-col gap-4 order-last border-l border-ev-cyan/30 pl-6 sticky top-8 self-start h-[calc(100vh-4rem)]">
        <p className="text-xs text-ev-cyan uppercase tracking-widest font-semibold">Teams</p>
        <button onClick={() => setShowCreateTeam(true)} className="text-left px-3 py-2.5 rounded-lg border border-dashed border-ev-cyan/40 text-ev-cyan text-sm hover:bg-ev-cyan/5 transition-colors shrink-0">
          + Add Team
        </button>
        <div className="scrollbar-hover flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">
          {teams.length === 0 ? (
            <p className="text-slate-500 text-xs px-3 pt-1">No teams registered</p>
          ) : (
            teams.map((team) => {
              const bid    = team.ecu_serial ? `ECU-${team.ecu_serial}` : null;
              const tframes = bid ? (boardData[bid] ?? []) : [];
              const last   = tframes.at(-1);
              const isLive = last && last.avg_voltage > 0 && (Date.now() - new Date(last.timestamp).getTime()) < 5000;
              const isDead = tframes.length > 0 && !isLive;

              return (
                <div key={team.id} className={["group relative flex items-center rounded-lg border transition-colors", selectedTeam?.id === team.id ? "bg-ev-orange/10 border-ev-orange/40" : "border-transparent hover:bg-slate-100"].join(" ")}>
                  <button onClick={() => setSelectedTeam(team)} className="flex-1 text-left px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className={["w-2 h-2 rounded-full shrink-0", isLive ? "bg-green-400 animate-pulse" : isDead ? "bg-red-400" : "bg-slate-300"].join(" ")} />
                      <p className="text-sm font-medium leading-tight text-slate-900">{team.team_name}</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 pl-3.5">{team.ecu_serial ? `ESP-${team.ecu_serial}` : "No ESP"}</p>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setConfigureTeam(team); }} className="pr-2.5 text-slate-300 hover:text-ev-orange transition-colors opacity-0 group-hover:opacity-100" title="Configure ESP">⚙</button>
                  <button onClick={(e) => { e.stopPropagation(); setTeamToUnassign(team); }} className="pr-2.5 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title="Unassign team">✕</button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {showCreateTeam && <CreateTeamModal teams={teams} competitionId={competition?.id} onClose={() => setShowCreateTeam(false)} onDone={() => { setShowCreateTeam(false); loadTeams(); }} />}
      {configureTeam  && <ConfigureTeamModal team={configureTeam} teams={registeredTeams.length > 0 ? registeredTeams : teams} onClose={() => setConfigureTeam(null)} onDone={() => { setConfigureTeam(null); loadTeams(); }} />}
      {teamToUnassign && competition && <ConfirmUnassignModal team={teamToUnassign} competition={competition} onCancel={() => setTeamToUnassign(null)} onConfirm={() => handleUnassignTeam(teamToUnassign)} />}
    </div>
  );
}
