import type { ECUFrame } from "../types"
import { get } from "./client"

export const ecuApi = {
  history: () => get<{ data: ECUFrame[] }>("/ecu/history"),
  serials: () => get<{ serials: number[] }>("/ecu/serials"),
}
