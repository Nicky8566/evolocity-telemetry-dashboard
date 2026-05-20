import type { CompetitionLeaderboard } from "../types"
import { get } from "./client"

export const scoringApi = {
  getLeaderboard: (competition_id: number) =>
    get<{ data: CompetitionLeaderboard }>(`/competitions/${competition_id}/leaderboard`),
}
