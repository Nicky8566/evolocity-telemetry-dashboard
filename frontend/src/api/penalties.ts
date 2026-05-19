import type { Penalty, PenaltyType } from "../types"
import { del, get, patch, post } from "./client"

export const penaltiesApi = {
  listByRun: (run_id: number) =>
    get<{ count: number; data: Penalty[] }>(`/penalties?run_id=${run_id}`),
  create: (payload: {
    run_id: number
    penalty_type: PenaltyType
    value: number
    unit: "seconds" | "points"
    note?: string
    applied_by?: string
  }) => post<{ data: Penalty }>("/penalties", payload),
  update: (id: number, payload: { value?: number; unit?: "seconds" | "points"; note?: string }) =>
    patch<{ data: Penalty }>(`/penalties/${id}`, payload),
  remove: (id: number) => del<{ data: Penalty }>(`/penalties/${id}`),
}
