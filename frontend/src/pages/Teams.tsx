import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { competitionsApi } from "../api/competitions";
import { teamsApi } from "../api/teams";
import ConfigureTeamModal from "../components/ui/ConfigureTeamModal";
import ConfirmUnassignModal from "../components/ui/ConfirmUnassignModal";
import CreateTeamModal from "../components/ui/CreateTeamModal";
import DeleteTeamModal from "../components/ui/DeleteTeamModal";
import { useTelemetry } from "../context/TelemetryContext";
import type { Competition, CompetitionDetail, Team } from "../types";

const EVENT_LABELS: Record<string, string> = {
  drag: "Drag Race",
  gymkhana: "Gymkhana",
  endurance: "Endurance",
  efficiency: "Efficiency",
};

export default function Teams() {
  const { boardData } = useTelemetry();
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitions, setCompetitions] = useState<CompetitionDetail[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [configureTeam, setConfigureTeam] = useState<Team | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [unassignTarget, setUnassignTarget] = useState<{
    team: Team;
    competition: CompetitionDetail;
  } | null>(null);
  const [assignCompetitionId, setAssignCompetitionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState("");

  async function loadData() {
    try {
      const [{ data: teamRows }, { data: competitionRows }] = await Promise.all(
        [teamsApi.list(), competitionsApi.list()],
      );

      const details = await Promise.all(
        competitionRows.map((competition: Competition) =>
          competitionsApi.getById(competition.id).then(({ data }) => data),
        ),
      );

      setTeams(teamRows);
      setCompetitions(details);
      setSelectedTeam((current) => {
        if (!current) return teamRows[0] ?? null;
        return (
          teamRows.find((team) => team.id === current.id) ?? teamRows[0] ?? null
        );
      });
    } catch (err) {
      console.error(err);
      setError("Failed to load teams");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedCompetitionMemberships = useMemo(
    () =>
      selectedTeam
        ? competitions.filter((competition) =>
            competition.teams.some((team) => team.id === selectedTeam.id),
          )
        : [],
    [competitions, selectedTeam],
  );

  const assignableCompetitions = useMemo(
    () =>
      selectedTeam
        ? competitions.filter(
            (competition) =>
              !competition.teams.some((team) => team.id === selectedTeam.id),
          )
        : [],
    [competitions, selectedTeam],
  );

  async function handleAssignCompetition() {
    if (!selectedTeam || !assignCompetitionId) return;
    setBusy(true);
    setError(null);
    try {
      await competitionsApi.assignTeam(
        parseInt(assignCompetitionId),
        selectedTeam.id,
      );
      setAssignCompetitionId("");
      await loadData();
    } catch {
      setError("Failed to assign team to competition");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnassignTeam(
    team: Team,
    competition: CompetitionDetail,
  ) {
    setBusy(true);
    setError(null);
    try {
      await competitionsApi.unassignTeam(competition.id, team.id);
      setUnassignTarget(null);
      await loadData();
    } catch {
      setError("Failed to unassign team");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteTeam() {
    if (!teamToDelete) return;
    setBusy(true);
    setError(null);
    try {
      await teamsApi.delete(teamToDelete.id);
      if (selectedTeam?.id === teamToDelete.id) {
        setSelectedTeam(null);
      }
      setTeamToDelete(null);
      await loadData();
    } catch {
      setError("Failed to delete team");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-8 min-h-0 h-full">
      <div className="flex-1 flex flex-col gap-6 min-w-0 order-first">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {selectedTeam ? selectedTeam.team_name : "Teams"}
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {selectedTeam
                ? `${selectedTeam.team_id} · ${selectedTeam.vehicle_class} ${selectedTeam.vehicle_type} · ${selectedCompetitionMemberships.length} competition${selectedCompetitionMemberships.length === 1 ? "" : "s"}`
                : "Create and manage teams independently of competitions"}
            </p>
          </div>

          {selectedTeam && (
            <div className="flex gap-2">
              <button
                onClick={() => setConfigureTeam(selectedTeam)}
                className="px-4 py-2 text-sm text-ev-cyan border border-ev-cyan/40 rounded-lg hover:bg-ev-cyan/5 transition-colors"
              >
                Configure ESP
              </button>
              <button
                onClick={() => setTeamToDelete(selectedTeam)}
                className="px-4 py-2 text-sm text-red-500 border border-red-500/30 rounded-lg hover:bg-red-500/5 transition-colors"
              >
                Delete Team
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-2 text-sm text-red-500">
            {error}
          </p>
        )}

        {!selectedTeam ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 opacity-40 select-none">
            <p className="text-5xl">👥</p>
            <p className="text-slate-700 font-medium">No team selected</p>
            <p className="text-slate-400 text-sm">
              Choose a team or create one from the panel
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border-t-2 border border-ev-border border-t-ev-cyan p-4 flex flex-col gap-1 bg-ev-panel shadow-sm">
                <p className="text-xs text-slate-500 uppercase tracking-widest">Team ID</p>
                <span className="text-xl font-bold tabular-nums text-slate-900">{selectedTeam.team_id}</span>
              </div>
              <div className="rounded-xl border-t-2 border border-ev-border border-t-ev-orange p-4 flex flex-col gap-1 bg-ev-panel shadow-sm">
                <p className="text-xs text-slate-500 uppercase tracking-widest">ESP</p>
                <span className="text-xl font-bold tabular-nums text-slate-900">{selectedTeam.ecu_serial ? `ESP-${selectedTeam.ecu_serial}` : "Unassigned"}</span>
              </div>
              <div className="rounded-xl border-t-2 border border-ev-border border-t-ev-blue p-4 flex flex-col gap-1 bg-ev-panel shadow-sm">
                <p className="text-xs text-slate-500 uppercase tracking-widest">Class</p>
                <span className="text-xl font-bold text-slate-900 capitalize">{selectedTeam.vehicle_class}</span>
              </div>
              <div className="rounded-xl border-t-2 border border-ev-border border-t-green-500 p-4 flex flex-col gap-1 bg-ev-panel shadow-sm">
                <p className="text-xs text-slate-500 uppercase tracking-widest">Vehicle</p>
                <span className="text-xl font-bold text-slate-900 capitalize">{selectedTeam.vehicle_type}</span>
              </div>
            </div>

            <section className="bg-ev-panel border border-ev-border rounded-xl p-5 flex flex-col gap-4 shadow-sm">
              <div>
                <p className="text-xs text-ev-cyan uppercase tracking-widest font-semibold mb-1">
                  Competition Assignments
                </p>
                <p className="text-sm text-slate-400">
                  Assign or unassign this team without recreating it.
                </p>
              </div>

              <div className="flex gap-2">
                <select
                  value={assignCompetitionId}
                  onChange={(e) => setAssignCompetitionId(e.target.value)}
                  className="min-w-0 flex-1 border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-ev-cyan max-w-xs truncate"
                >
                  <option value="">Choose competition…</option>
                  {assignableCompetitions.map((competition) => (
                    <option key={competition.id} value={String(competition.id)}>
                      {competition.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAssignCompetition}
                  disabled={!assignCompetitionId || busy}
                  className="px-4 py-2 text-sm text-white bg-ev-cyan rounded-lg hover:bg-ev-blue transition-colors disabled:opacity-50"
                >
                  Assign
                </button>
              </div>

              {competitions.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No competitions exist yet.
                </p>
              ) : selectedCompetitionMemberships.length === 0 ? (
                <p className="text-sm text-slate-400">
                  This team is not assigned to any competitions.
                </p>
              ) : (
                <div className="divide-y divide-ev-border rounded-lg border border-ev-border overflow-hidden">
                  {selectedCompetitionMemberships.map((competition) => (
                    <div
                      key={competition.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {competition.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {competition.event_types.map((e) => EVENT_LABELS[e] ?? e).join(" · ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          to={`/competitions/${competition.id}?team=${selectedTeam.id}`}
                          className="text-xs text-ev-cyan hover:underline shrink-0"
                        >
                          View →
                        </Link>
                        <button
                          onClick={() =>
                            setUnassignTarget({ team: selectedTeam, competition })
                          }
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-500 hover:bg-red-50 transition-colors"
                        >
                          Unassign
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <aside className="w-48 shrink-0 flex flex-col gap-4 order-last border-l border-ev-cyan/30 pl-6 sticky top-[5.75rem] self-start h-[calc(100vh-7.75rem)]">
        <p className="text-xs text-ev-cyan uppercase tracking-widest font-semibold">
          Teams
        </p>
        <input
          type="text"
          placeholder="Search…"
          value={sidebarSearch}
          onChange={(e) => setSidebarSearch(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-ev-border text-sm text-slate-700 bg-white focus:outline-none focus:border-ev-cyan shrink-0"
        />
        <button
          onClick={() => setShowCreate(true)}
          className="text-left px-3 py-2.5 rounded-lg border border-dashed border-ev-cyan/40 text-ev-cyan text-sm hover:bg-ev-cyan/5 transition-colors shrink-0"
        >
          + New Team
        </button>
        <div className="scrollbar-hover flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">
          {teams.length === 0 ? (
            <p className="text-slate-500 text-xs px-3 pt-1">
              No teams registered
            </p>
          ) : (
            teams.filter((team) => team.team_name.toLowerCase().includes(sidebarSearch.toLowerCase())).map((team) => {
              const bid = team.ecu_serial
                ? Object.keys(boardData)
                    .filter(k => parseInt(k.split("-")[1]) === team.ecu_serial)
                    .sort((a, b) => parseInt(a.split("-")[2] ?? "0") - parseInt(b.split("-")[2] ?? "0"))
                    .at(-1) ?? null
                : null;
              const tframes = bid ? (boardData[bid] ?? []) : [];
              const last = tframes.at(-1);
              const isLive = last && (Date.now() - (last.received_at_ms ?? 0)) < 5000;
              const isDead = tframes.length > 0 && !isLive;

              return (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team)}
                className={[
                  "text-left px-3 py-2.5 rounded-lg border transition-colors",
                  selectedTeam?.id === team.id
                    ? "bg-ev-orange/10 border-ev-orange/40"
                    : "border-transparent hover:bg-slate-100",
                ].join(" ")}
              >
                <div className="flex items-center gap-1.5">
                  <span className={["w-2 h-2 rounded-full shrink-0", isLive ? "bg-green-400 animate-pulse" : isDead ? "bg-red-400" : "bg-slate-300"].join(" ")} />
                  <p className="text-sm font-medium leading-tight text-slate-900">
                    {team.team_name}
                  </p>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 pl-3.5">
                  {team.ecu_serial ? `ESP-${team.ecu_serial}` : "No ESP"}
                </p>
              </button>
              );
            })
          )}
        </div>
      </aside>

      {showCreate && (
        <CreateTeamModal
          teams={teams}
          onClose={() => setShowCreate(false)}
          onDone={() => {
            setShowCreate(false);
            loadData();
          }}
        />
      )}

      {configureTeam && (
        <ConfigureTeamModal
          team={configureTeam}
          teams={teams}
          onClose={() => setConfigureTeam(null)}
          onDone={() => {
            setConfigureTeam(null);
            loadData();
          }}
        />
      )}

      {unassignTarget && (
        <ConfirmUnassignModal
          team={unassignTarget.team}
          competition={unassignTarget.competition}
          onCancel={() => setUnassignTarget(null)}
          onConfirm={() =>
            handleUnassignTeam(unassignTarget.team, unassignTarget.competition)
          }
        />
      )}

      {teamToDelete && (
        <DeleteTeamModal
          team={teamToDelete}
          memberships={competitions.filter((competition) =>
            competition.teams.some((team) => team.id === teamToDelete.id),
          )}
          busy={busy}
          onCancel={() => setTeamToDelete(null)}
          onConfirm={handleDeleteTeam}
        />
      )}
    </div>
  );
}