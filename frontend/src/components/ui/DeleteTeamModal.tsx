import type { CompetitionDetail, Team } from "../../types";

type DeleteTeamModalProps = {
  team: Team;
  memberships: CompetitionDetail[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteTeamModal({
  team,
  memberships,
  busy,
  onCancel,
  onConfirm,
}: DeleteTeamModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onCancel}
      />

      <div className="relative bg-ev-panel border border-ev-border rounded-2xl shadow-xl w-full max-w-sm flex flex-col gap-5 p-6">
        <div>
          <p className="text-xs text-red-500 uppercase tracking-widest font-semibold mb-1">
            Delete Team
          </p>

          <p className="text-slate-900 font-semibold text-base">
            Delete {team.team_name}?
          </p>

          <p className="text-slate-400 text-sm mt-1">
            This permanently deletes the team and removes it from{" "}
            {memberships.length} competition
            {memberships.length === 1 ? "" : "s"}. Telemetry history is not
            deleted.
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-500 border border-ev-border rounded-lg hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
