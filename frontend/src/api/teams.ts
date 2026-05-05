import type { CreateTeamPayload, Team } from "../types"
import { del, get, post } from "./client";

export const teamsApi = {
  list:      () => get<{ data: Team[] }>("/teams"),
  create:    (data: CreateTeamPayload) => post<{ data: Team }>("/teams/create", data),
  checkName: (name: string)   => get<{ data: Team[] }>(`/teams/names/${encodeURIComponent(name)}`),
  checkId:   (id: string)     => get<{ data: Team[] }>(`/teams/team_ids/${encodeURIComponent(id)}`),
  checkEcu:  (serial: string) => get<{ data: Team[] }>(`/teams/ecus/${serial}`),
  updateEcu: (id: number, ecu_serial: string | null) => post("/teams/update/ecu", { id, ecu_serial }),
  delete:    (id: number) => del<{ message: string }>(`/teams/${id}`),
}
