import type { Competition, CompetitionDetail } from "../types"
import { get, post } from "./client"

export const competitionsApi = {
  list:    () => get<{ data: Competition[] }>("/competitions"),
  getById: (id: number) => get<{ data: CompetitionDetail }>(`/competitions/${id}`),
  create:  (name: string) => post<{ competition: Competition }>("/competitions/create", { name }),
}
