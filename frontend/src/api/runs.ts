import type { EventType, Run, RunOutcome } from "../types"
import { get, post } from "./client"

export const runsApi = {
  list: (params: { team_id?: number; competition_id?: number; event_type?: EventType } = {}) => {
    const q = new URLSearchParams()
    if (params.team_id        != null) q.set("team_id",        String(params.team_id))
    if (params.competition_id != null) q.set("competition_id", String(params.competition_id))
    if (params.event_type     != null) q.set("event_type",     params.event_type)
    const suffix = q.toString() ? `?${q}` : ""
    return get<{ count: number; data: Run[] }>(`/runs${suffix}`)
  },
  start: (team_id: number, competition_id: number, event_type: EventType) =>
    post<{ data: Run }>("/runs/start", { team_id, competition_id, event_type }),
  stop: (id: number, outcome: Exclude<RunOutcome, "running"> = "finished") =>
    post<{ data: Run }>(`/runs/${id}/stop`, { outcome }),
}
