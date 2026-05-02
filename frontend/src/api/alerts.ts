import type { Alert } from "../types"
import { get } from "./client"

interface AlertsParams {
  ecu_serial?:     number
  competition_id?: number
  limit?:          number
}

export const alertsApi = {
  list: (params?: AlertsParams) => {
    const query = new URLSearchParams()
    if (params?.ecu_serial)     query.set("ecu_serial",     String(params.ecu_serial))
    if (params?.competition_id) query.set("competition_id", String(params.competition_id))
    if (params?.limit)          query.set("limit",          String(params.limit))
    const qs = query.toString()
    return get<{ data: Alert[] }>(`/alerts${qs ? `?${qs}` : ""}`)
  },
}
