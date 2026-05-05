import { useEffect, useMemo, useState } from "react";
import { competitionsApi } from "../../api/competitions";
import { ecuApi } from "../../api/ecu";
import { teamsApi } from "../../api/teams";
import type { Team } from "../../types";

interface Props {
  teams?: Team[];
  onClose: () => void;
  onDone: () => void;
  competitionId?: number;
}

const EMPTY = {
  name: "",
  team_id: "",
  vehicle_class: "standard",
  vehicle_type: "kart",
  ecu_serial: "",
};
interface FieldError {
  name?: string;
  team_id?: string;
  existing?: string;
}

export default function CreateTeamModal({
  teams = [],
  onClose,
  onDone,
  competitionId,
}: Props) {
  const [form, setForm] = useState({ ...EMPTY });
  const [errors, setErrors] = useState<FieldError>({});
  const [submitting, setSubmitting] = useState(false);
  const [allSerials, setAllSerials] = useState<number[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>(teams);
  const [mode, setMode] = useState<"create" | "existing">("create");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  useEffect(() => {
    ecuApi
      .serials()
      .then(({ serials }) => setAllSerials(serials))
      .catch(console.error);
  }, []);

  useEffect(() => {
    teamsApi
      .list()
      .then(({ data }) => setAllTeams(data))
      .catch(() => setAllTeams(teams));
  }, [teams]);

  const sourceTeams = allTeams.length > 0 ? allTeams : teams;

  // Serials already assigned to any team, not just teams in the current competition.
  const assignedSerials = useMemo(
    () =>
      new Set(
        sourceTeams
          .map((t) => t.ecu_serial)
          .filter((s): s is number => s !== null),
      ),
    [sourceTeams],
  );

  const availableSerials = useMemo(
    () => allSerials.filter((s) => !assignedSerials.has(s)),
    [allSerials, assignedSerials],
  );

  const assignedToCompetition = useMemo(
    () => new Set(teams.map((team) => team.id)),
    [teams],
  );

  const availableExistingTeams = useMemo(
    () =>
      competitionId == null
        ? []
        : sourceTeams.filter((team) => !assignedToCompetition.has(team.id)),
    [assignedToCompetition, competitionId, sourceTeams],
  );

  function setField(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function handleAssignExisting() {
    if (!competitionId || !selectedTeamId) return;
    setSubmitting(true);
    setErrors({});
    try {
      await competitionsApi.assignTeam(competitionId, parseInt(selectedTeamId));
      onDone();
    } catch {
      setErrors({ existing: "Failed to assign team" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (mode === "existing") {
      await handleAssignExisting();
      return;
    }

    if (!form.name.trim() || !form.team_id.trim()) return;
    setSubmitting(true);

    const errs: FieldError = {};
    const [nameRes, idRes] = await Promise.all([
      teamsApi.checkName(form.name.trim()),
      teamsApi.checkId(form.team_id.trim()),
    ]);
    if (nameRes.data.length > 0) errs.name = "Name already taken";
    if (idRes.data.length > 0) errs.team_id = "Team ID already taken";

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setSubmitting(false);
      return;
    }

    try {
      const { data: team } = await teamsApi.create({
        name: form.name.trim(),
        team_id: form.team_id.trim(),
        vehicle_class: form.vehicle_class,
        vehicle_type: form.vehicle_type,
        ecu_serial: form.ecu_serial,
      });
      if (competitionId != null) {
        await competitionsApi.assignTeam(competitionId, team.id);
      }
      onDone();
    } catch {
      setErrors({ name: "Failed to create team" });
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    mode === "existing"
      ? Boolean(selectedTeamId) && !submitting
      : Boolean(form.name.trim() && form.team_id.trim()) && !submitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-ev-panel border border-ev-border rounded-2xl shadow-xl w-full max-w-md flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs text-ev-cyan uppercase tracking-widest font-semibold">
            {competitionId ? "Add Team" : "Create Team"}
          </p>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {competitionId && (
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${mode === "create" ? "bg-white text-ev-cyan shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
            >
              New team
            </button>
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${mode === "existing" ? "bg-white text-ev-cyan shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
            >
              Existing team
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "existing" ? (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-500">Team to assign</label>
              <select
                value={selectedTeamId}
                onChange={(e) => {
                  setSelectedTeamId(e.target.value);
                  setErrors((prev) => ({ ...prev, existing: undefined }));
                }}
                className="border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-ev-cyan"
              >
                <option value="">Choose an existing team…</option>
                {availableExistingTeams.map((team) => (
                  <option key={team.id} value={String(team.id)}>
                    {team.team_name} ({team.team_id})
                  </option>
                ))}
              </select>
              {availableExistingTeams.length === 0 && (
                <p className="text-xs text-slate-400">
                  All existing teams are already assigned to this competition.
                </p>
              )}
              {errors.existing && (
                <p className="text-xs text-red-500">{errors.existing}</p>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">Team Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="e.g. Team Thunder"
                  className="border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-ev-cyan"
                />
                {errors.name && (
                  <p className="text-xs text-red-500">{errors.name}</p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">Team ID</label>
                <input
                  value={form.team_id}
                  onChange={(e) => setField("team_id", e.target.value)}
                  placeholder="e.g. T01"
                  className="border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-ev-cyan"
                />
                {errors.team_id && (
                  <p className="text-xs text-red-500">{errors.team_id}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">
                    Vehicle Class
                  </label>
                  <select
                    value={form.vehicle_class}
                    onChange={(e) => setField("vehicle_class", e.target.value)}
                    className="border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-ev-cyan"
                  >
                    <option value="standard">Standard</option>
                    <option value="open">Open</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-500">Vehicle Type</label>
                  <select
                    value={form.vehicle_type}
                    onChange={(e) => setField("vehicle_type", e.target.value)}
                    className="border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-ev-cyan"
                  >
                    <option value="kart">Kart</option>
                    <option value="bike">Bike</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500">
                  Assign ESP <span className="text-slate-400">(optional)</span>
                </label>
                <select
                  value={form.ecu_serial}
                  onChange={(e) => setField("ecu_serial", e.target.value)}
                  className="border border-ev-border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-ev-cyan"
                >
                  <option value="">— unassigned —</option>
                  {availableSerials.length === 0 && allSerials.length > 0 && (
                    <option disabled>No unassigned ESPs available</option>
                  )}
                  {availableSerials.map((s) => (
                    <option key={s} value={String(s)}>
                      ESP-{s}
                    </option>
                  ))}
                </select>
                {allSerials.length === 0 && (
                  <p className="text-xs text-slate-400">
                    No ESPs have connected yet
                  </p>
                )}
              </div>
            </>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-500 border border-ev-border rounded-lg hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 text-sm text-white bg-ev-cyan rounded-lg hover:bg-ev-blue transition-colors disabled:opacity-50"
            >
              {submitting
                ? mode === "existing"
                  ? "Assigning…"
                  : "Creating…"
                : mode === "existing"
                  ? "Assign Team"
                  : competitionId
                    ? "Create & Add"
                    : "Create Team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
