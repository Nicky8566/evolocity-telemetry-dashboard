import type { Competition } from "../types"
import { get, post } from "./client"

export const competitionsApi = {
  list:   () => get<{ data: Competition[] }>("/competitions"),
  create: (name: string) => post<{ data: Competition }>("/competitions", { name }),
}
