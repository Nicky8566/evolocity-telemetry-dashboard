import type { ECUFrame } from "../types"
import { del, get } from "./client"

export const ecuApi = {
  history: (params?: { ecu_serial?: number; from?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.ecu_serial != null) qs.set("ecu_serial", String(params.ecu_serial))
    if (params?.from)               qs.set("from", params.from)
    if (params?.limit  != null)     qs.set("limit",  String(params.limit))
    const query = qs.toString()
    return get<{ count: number; data: ECUFrame[] }>(`/ecu/history${query ? `?${query}` : ""}`)
  },
  serials: () => get<{ serials: number[] }>("/ecu/serials"),
  status:  () => get<{ devices: { ecu_serial: number; last_recorded_at: string; total_frames: number }[] }>("/ecu/status"),
  deleteEcu: (serial: number) => del<{ message: string }>(`/ecu/${serial}`),
}
