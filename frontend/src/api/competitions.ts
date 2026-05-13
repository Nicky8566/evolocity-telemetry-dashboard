import type { Competition, CompetitionDetail } from "../types"
import { get, post } from "./client"

export const competitionsApi = {
  list:       () => get<{ data: Competition[] }>("/competitions"),
  getById:    (id: number) => get<{ data: CompetitionDetail }>(`/competitions/${id}`),
  create:     (name: string, event_type: string) => post<{ data: Competition }>("/competitions", { name, event_type }),
  assignTeam: (competition_id: number, team_id: number) => post<{ message: string }>("/competitions/assign-team", { competition_id, team_id }),
  unassignTeam: (competition_id: number, team_id: number) => post<{ message: string }>("/competitions/unassign-team", { competition_id, team_id }),
}
