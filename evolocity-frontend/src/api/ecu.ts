import type { HistoryRow } from "../types"
import { get } from "./client"

export const ecuApi = {
  history: () => get<{ data: HistoryRow[] }>("/ecu/history"),
  serials: () => get<{ serials: number[] }>("/ecu/serials"),
}
